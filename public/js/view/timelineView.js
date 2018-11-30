/**
 * User: Matthieu Holzer
 * Date: 07.11.12
 * Time: 10:47
 */

define(["jquery", "backbone", 'underscore', 'utils', 'config', 'hbs!templates/timelineLayer', 'hbs!templates/timelineInfo', 'jquery++', 'jquery-scrollTo'],

    function ($, Backbone, _, Utils, Config, TimelineLayerTemplate, TimelineInfoTemplate) {

        return Backbone.View.extend({

            currentSequence : null,
            isPlaying       : false,

            initialize : function () {
                "use strict";
                _.bindAll(this, 'playheadChangeHandler', 'render', 'sequenceAddedHandler', 'sequenceRemovedHandler', 'sequenceChangedHandler', 'dragEndLayerBarHandler');

                this.model.get('sequences').on('add', this.sequenceAddedHandler);
                this.model.get('sequences').on('remove', this.sequenceRemovedHandler);
                this.model.get('sequences').on('change', this.sequenceChangedHandler);

                this.resetView();
                this.renderTimeScale();

                this.render();
            },

            events : {
                //jquery++ dnd events
                'draginit div.layer .bar' : 'draginitLayerBarHandler',
                'dragend div.layer .bar'  : 'dragEndLayerBarHandler',

                'draginit #picker' : 'dragInitPickerHandler',
                'dragend #picker'  : 'dragEndPickerHandler',

                'click #timescale'        : 'timescaleClickHandler',
                'click .layerInfo button' : 'buttonClickHandler',

                'click .layerInfo' : 'layerClickHandler',
                'click .layer'     : 'layerClickHandler',

                'keyup .layerInfo span' : 'layerInfoNameChangeHandler'
                // 'keydown'                   : 'keydownHandler'
            },

            draginitLayerBarHandler : function (e, drag) {
                "use strict";

                var $el = $(e.originalEvent.srcElement),
                    $layerContainer = $('#layerContainer'),
                    parent = $el.parent();

                drag.horizontal();
                drag.step({x : Config.GUI_TIMELINE_PIXEL_PER_FRAME}, $layerContainer);
                drag.scrolls($layerContainer, {
                    distance  : 50,
                    delta     : function (diff) {
                        return (50 - diff) / 2
                    },
                    direction : "x"
                });

            },

            dragEndLayerBarHandler : function (e, drag, drop) {
                "use strict";

                var $el = $(drag.element),
                    $parent = $el.parent(),
                    id = $parent.attr('data-id'),
                    pos = parseInt($el.css('left').replace('px', ''));

                //store the changes to the model
                if (!id) return;
                this.model.get('sequences').get(id).set('position', pos / Config.GUI_TIMELINE_PIXEL_PER_FRAME | 0);

            },

            dragInitPickerHandler : function (e, drag) {
                "use strict";

                drag.step({x : Config.GUI_TIMELINE_PIXEL_PER_FRAME});
                drag.horizontal();
                drag.limit($('#timescale'));
            },

            dragEndPickerHandler : function (e, drag, drop) {
                "use strict";
                var x = (this.$('#picker').css('left').replace('px', '')) | 0;
                this.changePlayheadPosition(x);
            },


            timescaleClickHandler : function (e) {
                "use strict";
                var x = e.originalEvent.pageX - $(e.target).parent().offset().left | 0;
                this.$('#picker').css('left', x);
                this.changePlayheadPosition(x);
            },

            layerInfoNameChangeHandler : function (e) {
                "use strict";
                var $target = $(e.target),
                    id = $target.parent().data('id'),
                    name = $target.text(),
                    seq = this.model.get('sequences').get(id);

                seq.set('name', name);
            },


            sequenceChangedHandler : function (sequence) {
                "use strict";
                this.renderSequence(sequence);
            },

            sequenceAddedHandler : function (sequence) {
                "use strict";
                this.renderSequence(sequence);
            },

            sequenceRemovedHandler : function (sequence) {
                "use strict";
                //removed from layerInfoContainer + layerContainer
                $('[data-id=' + sequence.id + ']').remove();

            },

            renderSequence : function (sequence) {
                "use strict";

                var $layerContainer = this.$('#layerContainer'),
                    $infoContainer = this.$('#layerInfoContainer'),
                    totalWidth = this.model.getTotalFrames() * Config.GUI_TIMELINE_PIXEL_PER_FRAME,
                    fps = this.model.get('fps'),
                    fpsScaleFactor = fps / (sequence.get('fps') > 0 ? sequence.get('fps') : 1),
                    data;

                data = _.extend(sequence.toJSON(), {
                    totalWidth  : totalWidth,
                    barWidth    : sequence.get('duration') / fpsScaleFactor * fps * Config.GUI_TIMELINE_PIXEL_PER_FRAME | 0,
                    barPosition : sequence.get('position') * Config.GUI_TIMELINE_PIXEL_PER_FRAME | 0
                });

                //already existent so update
                if ($layerContainer.find('[data-id=' + sequence.id + ']').length > 0) {
                    $layerContainer.find('[data-id=' + sequence.id + ']').replaceWith(TimelineLayerTemplate(data));
                }
                //non-existent so create
                else {
                    $layerContainer.append(TimelineLayerTemplate(data));
                    $infoContainer.append(TimelineInfoTemplate(data));
                }
            },

            render : function () {
                "use strict";

                var self = this,
                    $picker = this.$('#picker'),
                    $layerContainer = this.$('#layerContainer');

                $layerContainer.css('width', this.model.length + 'px');

                //update slider height
                $picker.css('height', 500);//$layerContainer.innerHeight() + Math.abs($picker.css('top').replace('px', '')));

                //render all sequence views
                this.model.get('sequences').each(function (sequence) {
                    self.renderSequence(sequence);
                });

                return this;
            },


            renderTimeScale : function () {
                "use strict";

                var $el = this.$('#timescale'),
                    ctx = [],
                    cCanvas = null, //currentCanvas
                    cCtx = null, //currentCtx
                    iCtx = 0, //currentCtxIndex
                    posX = 0;

                //change the total width of the container
                $el.css('width', this.model.getTotalFrames() * Config.GUI_TIMELINE_PIXEL_PER_FRAME + 1000); //TODO find number

                //canvas' width is limited, so we need to create more of them
                while (ctx.length < this.model.getTotalFrames() * Config.GUI_TIMELINE_PIXEL_PER_FRAME / Config.GUI_TIMELINE_CANVAS_MAX_WIDTH) {

                    //create canvas(es)
                    cCanvas = document.createElement('canvas');
                    cCtx = ctx.push(cCanvas.getContext('2d'));

                    //configure canvas
                    cCanvas.width = Config.GUI_TIMELINE_CANVAS_MAX_WIDTH;
                    cCanvas.height = 40;

                    //configure canvas
                    cCtx.fillStyle = '#000000';
                    cCtx.strokeStyle = '#000000';
                    cCtx.lineWidth = 1;
                    cCtx.lineCap = 'butt';
                    cCtx.font = "10pt Verdana";
                    cCtx.textAlign = "center";

                    //append do DOM
                    $el.append(cCanvas);
                }


                for (var frame = 0; frame <= this.model.getTotalFrames(); frame++) {

                    if (frame > (1 + iCtx) * Config.GUI_TIMELINE_CANVAS_MAX_WIDTH / Config.GUI_TIMELINE_PIXEL_PER_FRAME) {

                        iCtx++;

                        //substract the already existent canvas-elements
                        //as each canvas starts at 0
                        posX = iCtx * Config.GUI_TIMELINE_CANVAS_MAX_WIDTH / 3;

                    }

                    ctx[iCtx].beginPath();
                    ctx[iCtx].moveTo((frame - posX) * Config.GUI_TIMELINE_PIXEL_PER_FRAME, 0);

                    //start 00:00:00:00
                    if (frame === 0) {
                        ctx[0].lineTo(0, 22);
                        ctx[0].fillText('Start', 4, 34);
                    }

                    //got a second
                    else if (frame % this.model.get('fps') === 0) {
                        ctx[iCtx].lineTo((frame - posX) * Config.GUI_TIMELINE_PIXEL_PER_FRAME, 22);
                        ctx[iCtx].fillText(Utils.getCleanTimeCode(frame, this.model.get('fps')), (frame - posX) * Config.GUI_TIMELINE_PIXEL_PER_FRAME - 20, 34);

                    }

                    //just a frame
                    else {
                        ctx[iCtx].lineTo((frame - posX) * Config.GUI_TIMELINE_PIXEL_PER_FRAME, 14);
                    }

                    ctx[iCtx].closePath();
                    ctx[iCtx].stroke();
                    ctx[iCtx].fill();
                }
            },

            resetView : function () {
                "use strict";
                this.$('#timescale, #layerInfoContainer').empty();
                this.$('#layerContainer .layer').remove();
            },

            buttonClickHandler : function (e) {
                "use strict";

                var $target = $(e.target),
                    $parent = $target.parent(),
                    id = $parent.attr("data-id"),
                    cmd = $target.attr("data-cmd"),
                    sequences = this.model.get('sequences'),
                    sequencesAmount = sequences.length - 1,
                    sequence = sequences.get(id),
                    stack = parseInt(sequence.get('stack'), 10);


                switch (cmd) {

                    case 'up' :
                        if (stack > 0) {
                            this.swapSequences(stack, stack - 1);
                        }
                        break;

                    case 'down' :
                        if (stack < sequencesAmount) {
                            this.swapSequences(stack, stack + 1);
                        }
                        break;

                    case 'reset' :
                        sequence.resetToDefaults();
                        break;

                    case 'remove' :
                        sequences.remove(sequence);
                        break;


                }


            },

            swapSequences : function (sourceStack, targetStack) {
                "use strict";
                var sequences = this.model.get('sequences'),
                    $sourceInfo = this.$('.layerInfo[data-stack="' + sourceStack + '"]'),
                    $sourceLayer = this.$('.layer[data-stack="' + sourceStack + '"]'),
                    sourceSeqId = $sourceInfo.attr('data-id'),
                    sourceSeq = sequences.get(sourceSeqId),
                    $targetInfo = this.$('.layerInfo[data-stack="' + targetStack + '"]'),
                    $targetLayer = this.$('.layer[data-stack="' + targetStack + '"]'),
                    targetSeqId = $targetInfo.attr('data-id'),
                    targetSeq = sequences.get(targetSeqId);

                if (sourceStack > targetStack) {
                    $sourceInfo.insertBefore($targetInfo);
                    $sourceLayer.insertBefore($targetLayer);
                }
                else {
                    $sourceInfo.insertAfter($targetInfo);
                    $sourceLayer.insertAfter($targetLayer);
                }

                //just to make sure even if i gets rerendered
                $sourceInfo.attr('data-stack', targetStack);
                $sourceLayer.attr('data-stack', targetStack);
                $targetInfo.attr('data-stack', sourceStack);
                $targetLayer.attr('data-stack', sourceStack);

                sourceSeq.set('stack', targetStack);
                targetSeq.set('stack', sourceStack);

                this.renderSequence(sourceSeq);
                this.renderSequence(targetSeq);

            },

            changePlayheadPosition : function (frame) {
                "use strict";

                frame = frame / Config.GUI_TIMELINE_PIXEL_PER_FRAME | 0;

                if (frame >= 0 && frame <= this.model.getTotalFrames()) {
                    this.model.set('playhead', frame);
                }
            },

            togglePlayPause : function () {
                "use strict";
                this.isPlaying ? this.removePlayheadListener() : this.addPlayheadListener();
                this.isPlaying = !this.isPlaying;
            },


            addPlayheadListener : function () {
                "use strict";
                this.model.on('change:playhead', this.playheadChangeHandler);
            },

            removePlayheadListener : function () {
                "use strict";
                this.model.off('change:playhead', this.playheadChangeHandler);
            },

            playheadChangeHandler : function (e, xPos) {
                "use strict";
                var $layerInfoContainer = $('#layerInfoContainer'),
                    $layerContainer = $('#layerContainer'),
                    viewportWidth = this.$el.width() - $layerInfoContainer.width() - Config.GUI_TIMELINE_AUTOSCROLL_PADDING;

                //viewportWidth must be divisible by frameWidth
                while (viewportWidth % Config.GUI_TIMELINE_PIXEL_PER_FRAME > 0) {
                    viewportWidth--;
                }

                xPos *= Config.GUI_TIMELINE_PIXEL_PER_FRAME;

                //autoscroll the timeline if playhead is moving
                if (xPos % (viewportWidth) === 0) {
                    $layerContainer.scrollTo('#picker');
                }

                $('#picker').css('left', xPos);

            },

            keydownHandler : function (e) {
                "use strict";
                //TODO control playback via keys
            },

            layerClickHandler : function (e) {
                "use strict";
                var $target = $(e.target),
                    id;

                while (!$target.attr('data-id')) {
                    $target = $target.parent();
                }

                id = $target.attr('data-id');

                //TODO highlight sequence on stage

            },

            highlight : function () {
                "use strict";
                var $layerInfoContainer = $('#layerInfoContainer'),
                    $layerContainer = $('#layerContainer'),
                    id = this.currentSequence.model.id;

                //deactivate all
                $layerInfoContainer.find('div.layerInfo').removeClass('active');
                $layerContainer.find('div.layer').removeClass('active');

                //highlight current
                $layerInfoContainer.find('div.layerInfo[data-id="' + id + '"]').addClass('active');
                $layerContainer.find('div.layer[data-id="' + id + '"]').addClass('active');

            }

        });


    })
;