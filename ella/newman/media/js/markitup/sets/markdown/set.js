// -------------------------------------------------------------------
// markItUp!
// -------------------------------------------------------------------
// Copyright (C) 2008 Jay Salvat
// http://markitup.jaysalvat.com/
// -------------------------------------------------------------------
// MarkDown tags example
// http://en.wikipedia.org/wiki/Markdown
// http://daringfireball.net/projects/markdown/
// -------------------------------------------------------------------
// Feel free to add more tags
// -------------------------------------------------------------------\

var MARKITUP_PREVIEW_SIZE_ADDITION = 10; //px
var focused;
var edit_content;
var getIdFromPath = function(path){
    var id;
    $.each(AVAILABLE_CONTENT_TYPES, function(i){
        if(this.path == '/'+path.replace('.','/')+'/'){
            id = i;
            return;
        }
    });
    return id;
}

MARKITUP_SETTINGS = {
    previewParserPath:    BASE_URL + 'nm/editor-preview/',
    previewParserVar:   "text",
    previewPosition: 'afterArea',
    onShiftEnter:              {keepDefault:false, openWith:'\n\n'},
    markupSet: [
        { name: gettext('Italic'), className: 'italic', key: 'I', openWith: '*', closeWith: '*' },
        { name: gettext('Bold'), className: 'bold', key: 'B', openWith: '**', closeWith: '**' },
        { separator: '---------------' },
        { name: gettext('Link'), className: 'url', key: 'L', openWith:'[', closeWith:']([![Url:!:http://]!] "[![Title]!]")', placeHolder: 'Text odkazu' },
        { separator: '---------------' },
        { name: gettext('Head 1'), className: 'h1', key:'1', placeHolder: 'Nadpis 1. úrovně', closeWith: function(markItUp) { return miu.markdownTitle(markItUp, '=') } },
        { name: gettext('Head 2'), className: 'h2', key:'2', placeHolder: 'Nadpis 2. úrovně', closeWith: function(markItUp) { return miu.markdownTitle(markItUp, '-') } },
        { name: gettext('Head 3'), className: 'h3', key:'3', placeHolder: 'Nadpis 3. úrovně', openWith: '### ' },
        { separator: '---------------' },
        { name: gettext('List unordered'), className: 'list-bullet', openWith: '- ' },
        { name: gettext('List ordered'), className: 'list-numeric', openWith:function(markItUp) {
            return markItUp.line+'. ';
        }},
        { separator: '---------------' },
        { name: gettext('Quote'), className: 'quote', openWith: '> ' },
        { separator: '---------------' },
        { name: gettext('Photo'), className: 'photo', call: function(){
            $('#rich-box').dialog('open');
            $('#id_box_obj_ct').val(getIdFromPath('photos.photo')).trigger('change');// 20 is value for photos.photo in the select box
            $('#lookup_id_box_obj_id').trigger('click');
        }},
        { name: gettext('Gallery'), className: 'gallery', call: function(){
            $('#rich-box').dialog('open');
            $('#id_box_obj_ct').val(getIdFromPath('galleries.gallery')).trigger('change');// 37 is value for galleries.gallery
        }},
        { name: gettext('Box'), className: 'box', call: function(){
            $('#rich-box').dialog('open');
            // Edit box
            if(focused){
                var range = focused.getSelection();
                var content = focused.val();
                if(content.match(/\{% box(.|\n)+\{% endbox %\}/g) && range.start != -1){
                    var start = content.substring(0,range.start).lastIndexOf('{% box');
                    var end = content.indexOf('{% endbox %}',range.end);
                    if(start != -1 && end != -1 && content.substring(start,range.start).indexOf('{% endbox %}') == -1){
                        var box = content.substring(start,end+12);
                        edit_content = box;
                        var id = box.replace(/^.+pk (\d+) (.|\n)+$/,'$1');
                        var mode = box.replace(/^.+box (\w+) for(.|\n)+$/,'$1');
                        var type = box.replace(/^.+for (\w+\.\w+) (.|\n)+$/,'$1');
                        var params = box.replace(/^.+%\}\n?((.|\n)*)\{% endbox %\}$/,'$1');
                        $('#id_box_obj_ct').val(getIdFromPath(type)).trigger('change');
                        $('#id_box_obj_id').val(id);
                        if(type == 'photos.photo'){
                            if(box.indexOf('show_title:1') != -1){
                                $('#id_box_photo_meta_show_title').attr('checked','checked');
                            } else $('#id_box_photo_meta_show_title').removeAttr('checked');
                            if(box.indexOf('show_author:1') != -1){
                                $('#id_box_photo_meta_show_author').attr('checked','checked');
                            } else $('#id_box_photo_meta_show_author').removeAttr('checked');
                            if(box.indexOf('show_description:1') != -1){
                                $('#id_box_photo_meta_show_description').attr('checked','checked');
                            } else $('#id_box_photo_meta_show_description').removeAttr('checked');
                            if(box.indexOf('show_detail:1') != -1){
                                $('#id_box_photo_meta_show_detail').attr('checked','checked');
                            } else $('#id_box_photo_meta_show_detail').removeAttr('checked');
                            params = params.replace(/show_title:\d/,'').replace(/show_author:\d/,'').replace(/show_description:\d/,'').replace(/show_detail:\d/,'').replace(/\n{2,}/g,'\n').replace(/\s{2,}/g,' ');
                            if(mode.indexOf('inline_velka') != -1){
                                $('#id_box_photo_size').val('velka')
                            } else if(mode.indexOf('inline_standard') != -1){
                                $('#id_box_photo_size').val('standard')
                            } else if(mode.indexOf('inline_mala') != -1){
                                $('#id_box_photo_size').val('mala')
                            }
                            if(mode.indexOf('ctverec') != -1){
                                $('#id_box_photo_format').val('ctverec')
                            } else if(mode.indexOf('obdelnik_sirka') != -1){
                                $('#id_box_photo_format').val('obdelnik_sirka')
                            } else if(mode.indexOf('obdelnik_vyska') != -1){
                                $('#id_box_photo_format').val('obdelnik_vyska')
                            } else if(mode.indexOf('nudle_sirka') != -1){
                                $('#id_box_photo_format').val('nudle_sirka')
                            } else if(mode.indexOf('nudle_vyska') != -1){
                                $('#id_box_photo_format').val('nudle_vyska')
                            }
                        }
                        $('#id_box_obj_params').val(params);
                    }
                }
            }
        }},
        { separator: '---------------' },
        { name: gettext('Quick preview'), call: 'preview', className: 'preview'},
        { name: gettext('Preview on site'), call: 'preview_on_site', className: 'preview_on_site'}
    ]
}

$(function(){
    var getTypeFromPath = function(id){
        var path = AVAILABLE_CONTENT_TYPES[id].path;
        return path.substring(1,path.length - 1).replace('/','.');
    }
    if(!$('#rich-box').length){
        $('<div id="rich-box" title="Box"></div>').hide().appendTo('body');
        $('#rich-box').load(BASE_URL+'nm/editor-box/', function(){
            $('#id_box_obj_ct').bind('change', function(){
                if(getTypeFromPath($('#id_box_obj_ct').val()) == 'photos.photo'){
                    $('#rich-photo-format').show();
                } else {
                    $('#rich-photo-format').hide();
                }
            });
            $('#lookup_id_box_obj_id').bind('click', function(e){
                e.preventDefault();
                open_overlay(getTypeFromPath($('#id_box_obj_ct').val()), function(id){
                    $('#id_box_obj_id').val(id);
                });
            });
            $('#rich-object').bind('submit', function(e){
                e.preventDefault();
                if($('#id_box_obj_ct').val()){
                    var type = getTypeFromPath($('#id_box_obj_ct').val());
                    if(!!type){
                        var id = $('#id_box_obj_id').val() || '0';
                        var params = $('#id_box_obj_params').val().replace(/\n+/g, ' ');
                        // Add format and size info for photo
                        var addon = '';
                        if(getTypeFromPath($('#id_box_obj_ct').val()) == 'photos.photo'){
                            addon = '_'+$('#id_box_photo_size').val()+'_'+$('#id_box_photo_format').val();
                            // Add extra parameters
                            $('.photo-meta input[type=checkbox]:checked','#rich-photo-format').each(function(){
                                params += ((params) ? '\n' : '') + $(this).attr('name').replace('box_photo_meta_','') + ':1';
                            });
                        }
                        // Insert code
                        if(!edit_content){
                            $.markItUp({
                                openWith:'{% box inline'+addon+' for '+type+' with pk '+$('#id_box_obj_id').val()+' %}'+((params) ? '\n'+params+'\n' : '')+'{% endbox %}'
                            });
                        } else if(focused){
                            var old = focused.val();
                            focused.val(old.replace(edit_content,'{% box inline'+addon+' for '+type+' with pk '+$('#id_box_obj_id').val()+' %}'+((params) ? '\n'+params+'\n' : '')+'{% endbox %}'))
                            edit_content = '';
                        }
                        // Reset and close dialog
                        $('#rich-object').trigger('reset');
                        $('#rich-box').dialog('close');
                        $('#id_box_obj_ct').trigger('change');
                    }
                }
            });
        });
        $('#rich-box').dialog({
            modal: false,
            autoOpen: false,
            width: 420,
            height: 360
        });
    }
    $('.rich_text_area').markItUp(MARKITUP_SETTINGS).focus(function(){
        focused = $(this);
    });
    // Small rich area
    function set_textarea_height() {
        $('.rich_text_area').each(function(){
            if($(this).hasClass('small')){
                $(this).removeClass('small');
                $(this).parents('.markItUp').addClass('small');
            }
        });
    }
    set_textarea_height();
    $(document).bind('content_added', set_textarea_height);
});

// mIu nameSpace to avoid conflict.
miu = {
    markdownTitle: function(markItUp, char) {
        heading = '';
        n = $.trim(markItUp.selection||markItUp.placeHolder).length;
        for(i = 0; i < n; i++) {
            heading += char;
        }
        return '\n'+heading;
    }
}

function preview_on_site() {

    inputs = $('form.change-form :input');

    category = /\d/.exec($('#id_category').attr('value'));
    if (category == null) {
        msg = gettext('Category field must be filled for preview on site!');
        alert(msg);
        return;
    }

    alert("Sorry, this function is not implemented!");
    return;

}


function preview_iframe_height($iFrame, $txArea) {
    if ($iFrame) {
        $iFrame.css("height", Math.max(50, $txArea.height() + MARKITUP_PREVIEW_SIZE_ADDITION)+"px");
    }
}

function preview_height_correct(evt) {
    var $container = $(evt.currentTarget).parents('.markItUpContainer');
    var $editor = $container.find('.markItUpEditor');
    var $iFrame = $container.find('iframe');
    preview_iframe_height($iFrame, $editor);
}

function markitdown_get_editor(evt) {
    var $container = $(evt.currentTarget).parents('.markItUpContainer');
    var $editor = $container.find('.markItUpEditor');
    return $editor;
}

function markitdown_get_preview_element(evt) {
    var $container = $(evt.currentTarget).parents('.markItUpContainer');
    var $iFrame = $container.find('iframe');
    var $doc = $( $iFrame.attr('contentWindow').document );
    var $preview_a_element = $container.find('.preview').find('a');
    return $preview_a_element;
}

function markitdown_trigger_preview(evt) {
    // click into preview iframe causes reload of the iframe
    var $preview_a_element = markitdown_get_preview_element(evt);
    $preview_a_element.trigger('mouseup'); 
}

function register_preview_action_click_on_iframe(evt) {
    var $preview_a_element = markitdown_get_preview_element(evt);
    $doc.bind('click', function(evt) {
        // click into preview iframe causes reload of the iframe
        $preview_a_element.trigger('mouseup'); 
    });
}

// resize appropriately after enter key is pressed inside markItUp <textarea> element.
function enter_pressed_callback(evt) {

    var $txArea = $(evt.currentTarget);
    var $container = $txArea.parents('.markItUpContainer');
    var $iFrame = $container.find('iframe');
    preview_iframe_height($iFrame, $txArea);
}

function markitdown_auto_preview(evt) {
    var AGE = 2500;
    var $editor = markitdown_get_editor(evt);
    var last_auto_updated = Number($editor.data('last_auto_preview'));
    var existing_tm = $editor.data('auto_preview_timer');
    var now = new Date().getTime();

    if ( ((last_auto_updated + AGE) < now) || (!last_auto_updated) ) {
        carp('Auto preview triggering preview');
        if (existing_tm) {
            clearTimeout(existing_tm);
            existing_tm = null;
        }
        $editor.data('last_auto_preview', now);
        markitdown_trigger_preview(evt);
    } else {
        carp('Autopreview not triggered');
        if (!existing_tm) {
            var tm = setTimeout(function() {markitdown_auto_preview(evt); }, AGE);
            $editor.data('auto_preview_timer', tm);
            carp('Update timer set.');
        }
    }
}

function register_markitup_editor_enter_callback(args) {
    var RESIZE_DELAY_MSEC = 1250;
    $(this).bind(
        'keyup',
        function(evt) {
            var key_code = evt.keyCode || evt.which;
            key_code = parseInt(key_code);
            var ENTER = 13;
            var KEY_A = 65;
            var KEY_Z = 90;
            var KEY_0 = 48;
            var KEY_9 = 57;
            // auto refresh preview
            /*if ((key_code >= KEY_A && key_code <= KEY_Z) || (key_code >= KEY_0 && key_code <= KEY_9)) {
                // FIXME auto update sucks and causes letter-loss when typing text into the textarea!
                markitdown_auto_preview(evt);
            }*/
            // if not return pressed, textarea resize won't be done.
            if (key_code != ENTER) return;
            setTimeout(function() {enter_pressed_callback(evt); }, RESIZE_DELAY_MSEC);
        }
    );
}

$(document).bind(
    'media_loaded',
    function () {
        $('.markItUpEditor').each(register_markitup_editor_enter_callback);
        $('li.preview').bind('click', preview_height_correct);
        //$('li.preview').one('click', register_preview_action_click_on_iframe); //does not work properly after first click
    }
);


$(document).bind('media_loaded', function(){ $('textarea.rich_text_area').autogrow() });
