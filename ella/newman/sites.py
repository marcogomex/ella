from django import template
from django.contrib.admin.sites import AdminSite
from django.shortcuts import render_to_response
from django.utils.functional import update_wrapper
from django.utils.translation import ugettext, ugettext_lazy as _
from django.db import models
from django.http import HttpResponse, HttpResponseRedirect
from django.core.mail import EmailMessage
from django.views.decorators.cache import never_cache
from django.contrib.auth import authenticate, login, logout
from django.contrib.contenttypes.models import ContentType
from django.conf import settings

from ella.newman.forms import SiteFilterForm, ErrorReportForm
from ella.newman.models import AdminSetting
from ella.newman.decorators import require_AJAX
from ella.newman.utils import set_user_config_db, set_user_config_session, get_user_config,\
    JsonResponse, JsonResponseError, json_decode
from ella.newman.permission import has_model_list_permission, applicable_categories
from ella.newman.config import CATEGORY_FILTER, NEWMAN_URL_PREFIX, STATUS_SMTP_ERROR, STATUS_FORM_ERROR
from ella.newman.options import NewmanModelAdmin


class NewmanSite(AdminSite):
    norole_template = None

    def append_inline(self, to_models=(), inline=None):
        """
        Dynamic append inline to model admin options.
        """
        for s in to_models:
            app_name, model_name = s.split('.')
            model = models.get_model(app_name, model_name)
            if model in self._registry.keys():
                opts_class = self._registry[model].__class__
                opts_class.inlines.append(inline)
                self.unregister(model)
                self.register(model, opts_class)

    def register(self, model_or_iterable, admin_class=None, **options):
        """
        If an admin class isn't given, it will use NewmanModelAdmin.
        """
        if not admin_class:
            admin_class = NewmanModelAdmin

        super(NewmanSite, self).register(model_or_iterable, admin_class, **options)


    def get_urls(self):
        from django.conf.urls.defaults import patterns, url

        def wrap(view):
            def wrapper(*args, **kwargs):
                return self.admin_view(view)(*args, **kwargs)
            return update_wrapper(wrapper, view)

        # Newman specific URLs
        urlpatterns = patterns('',
            url(r'^%s/err-report/$' % NEWMAN_URL_PREFIX,
                wrap(self.err_report),
                name="newman-err-report"),
            url(r'^%s/save-filters/$' % NEWMAN_URL_PREFIX,
                wrap(self.cat_filters_save),
                name="newman-save-filters"),
#            url(r'^$',
#                wrap(self.index),
#                name='%sadmin_index' % self.name),
        )

        if 'djangomarkup' in settings.INSTALLED_APPS:
            urlpatterns += patterns('',
                url(r'^%s/editor-preview/$' % NEWMAN_URL_PREFIX,
                    'djangomarkup.views.preview',
                    name="djangomarkup-preview"),
            )

        urlpatterns += super(NewmanSite, self).get_urls()
        return urlpatterns

    @never_cache
    def login(self, request):
        """
        Displays the login form for the given HttpRequest.
        """
        from django.contrib.auth.models import User

        ERROR_MESSAGE = _("Please enter a correct username and password. Note that both fields are case-sensitive.")
        LOGIN_FORM_KEY = 'this_is_the_login_form'

        # If this isn't already the login page, display it.
        if not request.POST.has_key(LOGIN_FORM_KEY):
            if request.POST:
                message = _("Please log in again, because your session has expired.")
            else:
                message = ""
            return self.display_login_form(request, message)

        # Check that the user accepts cookies.
        if not request.session.test_cookie_worked():
            message = _("Looks like your browser isn't configured to accept cookies. Please enable cookies, reload this page, and try again.")
            return self.display_login_form(request, message)
        else:
            request.session.delete_test_cookie()

        # Check the password.
        username = request.POST.get('username', None)
        password = request.POST.get('password', None)
        user = authenticate(username=username, password=password)
        if user is None:
            message = ERROR_MESSAGE
            if u'@' in username:
                # Mistakenly entered e-mail address instead of username? Look it up.
                try:
                    user = User.objects.get(email=username)
                except (User.DoesNotExist, User.MultipleObjectsReturned):
                    message = _("Usernames cannot contain the '@' character.")
                else:
                    if user.check_password(password):
                        message = _("Your e-mail address is not your username."
                                    " Try '%s' instead.") % user.username
                    else:
                        message = _("Usernames cannot contain the '@' character.")
            return self.display_login_form(request, message)

        # The user data is correct; log in the user in and continue.
        else:
            if user.is_active and user.is_staff:
                login(request, user)
                # user has no applicable categories, probably his role is undefined
                if not applicable_categories(user):
                    return self.norole(request, user)
                # load all user's specific settings into session
                for c in AdminSetting.objects.filter(user=user):
                    uc = get_user_config(user, c.var)
                    set_user_config_session(request.session, c.var, uc)
                return HttpResponseRedirect(request.get_full_path())
            else:
                return self.display_login_form(request, ERROR_MESSAGE)

    def norole(self, request, user):
        context = {
            'title': _('Site administration'),
            'user': user,
        }
        logout(request)
        return render_to_response(
            self.norole_template or 'admin/error_norole.html',
            context,
            context_instance=template.RequestContext(request)
        )

    def index(self, request, extra_context=None):
        """
        Displays the main Newman index page, without installed apps.
        """
        data = {'sites': []}
        try:
            data['sites'] = get_user_config(request.user, CATEGORY_FILTER)
        except KeyError:
            data['sites'] = []

        site_filter_form = SiteFilterForm(data=data, user=request.user)
        cts = []
        last_filters = {}
        for model, model_admin in self._registry.items():
            if has_model_list_permission(request.user, model):
                ct = ContentType.objects.get_for_model(model)
                cts.append(ct)
                # Load saved filter configurations for changelists
                key = 'filter__%s__%s' % (ct.app_label, ct.model)
                last_filter = AdminSetting.objects.filter(var=key, user=request.user)
                if last_filter:
                    last_filters[key] = '?%s' % json_decode(last_filter[0].value)

        context = {
            'title': _('Site administration'),
            'site_filter_form': site_filter_form,
            'searchable_content_types': cts,
            'last_filters': last_filters
        }
        context.update(extra_context or {})
        return render_to_response(self.index_template or 'admin/index.html', context,
            context_instance=template.RequestContext(request)
        )

    @require_AJAX
    def err_report(self, request, extra_context=None):
        """
        Sends error report or feature request to administrator.
        """

        from django.conf import settings

        form = ErrorReportForm(request.POST)
        if form.is_valid():
            try:
                e = EmailMessage('Newman report: %s' % form.cleaned_data['err_subject'], form.cleaned_data['err_message'],
                                 from_email=request.user.email, to=settings.ERR_REPORT_RECIPIENTS)
                e.send()
                return JsonResponse(ugettext('Your report was sent.'))
            except:
                return JsonResponseError(ugettext('SMTP error.'), status=STATUS_SMTP_ERROR)
        else:
            error_dict = {}
            for e in form.errors:
                error_dict[u"id_%s" % e] = [ u"%s" % ee for ee in form.errors[e] ]
            return JsonResponse(ugettext('Subject or message is empty.'), errors=error_dict, status=STATUS_FORM_ERROR)

    @require_AJAX
    def cat_filters_save(self, request, extra_content=None):

        site_filter_form = SiteFilterForm(user=request.user, data=request.POST)
        if site_filter_form.is_valid():
            set_user_config_db(request.user, CATEGORY_FILTER, site_filter_form.cleaned_data['sites'])
            set_user_config_session(request.session, CATEGORY_FILTER, site_filter_form.cleaned_data['sites'])
            return JsonResponse(ugettext('Your settings were saved.'))
        else:
            return JsonResponseError(ugettext('Error in form.'), status=STATUS_FORM_ERROR)


site = NewmanSite()
