/**
 * User: Matthieu Holzer
 * Date: 15.11.12
 * Time: 21:51
 */

define(['jquery', 'underscore', 'backbone', 'hbs!templates/sequenceCut'], function ($, _, Backbone, Template) {

    return Backbone.View.extend({

        asset     : null,
        video     : null,
        isPlaying : false,

        initialize : function () {
            'use strict';
            this.asset = this.model.getAsset();
        },

        events : {
            'click button' : 'buttonClickHandler'
        },


        buttonClickHandler : function (e) {
            "use strict";

            var $target = $(e.target),
                fps = this.model.get('fps') | 0;

            if ($target.hasClass('close')) {
                this.destroy();
                return;
            }

            switch ($target.attr('data-cmd')) {
                case 'frameRewind' :
                    this.rewind(1);
                    break;
                case 'framePrev' :
                    this.rewind(1 / fps);
                    break;
                case 'frameForward' :
                    this.forward(1);
                    break;
                case 'frameNext' :
                    this.forward(1 / fps);
                    break;

                case 'togglePlay' :
                    if (this.isPlaying) {
                        $target.removeClass('pause').addClass('play');
                        this.video.pause();
                    }
                    else {
                        $target.removeClass('play').addClass('pause');
                        this.video.play();
                    }
                    this.isPlaying = !this.isPlaying;
                    break;

                case 'frameIn' :
                    this.setMarker('inFrame');
                    break;
                case 'frameOut' :
                    this.setMarker('outFrame');
                    break;
                case 'jumpToOut' :
                    this.jumpTo(this.model.get('outFrame'));
                    break;
                case 'jumpToIn' :
                    this.jumpTo(this.model.get('inFrame'));
                    break;

            }
        },

        render : function () {
            'use strict';

            this.$el.html(Template(this.model.toJSON()));

            //doing this via the handlebars-template will fail cause the request will be send via XHR,
            //which is just wrong ... i guess
            this.video = document.createElement('video');

            //Load the video
            this.video.src = this.asset.getCompatibleMediaUrl();
            this.video.controls = true;
            this.video.width = this.asset.get('width');
            this.video.height = this.asset.get('height');

            this.$('.video').append(this.video);
        },

        rewind : function (frames) {
            "use strict";
            this.seek(frames, -1);
        },

        forward : function (frames) {
            "use strict";
            this.seek(frames, 1);
        },

        seek : function (frames, dir) {
            "use strict";
            var seek = this.video.currentTime + ((dir < 1) ? frames * -1 : frames);
            if (this.isReady() && seek <= this.video.duration && seek >= 0) this.video.currentTime = seek;
        },

        setMarker : function (type) {
            "use strict";
            var fps = this.model.get('fps'),
                current = this.video.currentTime,
                currentMarkerPosition = fps * current | 0;

            if ((type === 'outFrame' && this.model.get('inFrame') === currentMarkerPosition) ||
                (type === 'inFrame' && this.model.get('outFrame') === currentMarkerPosition)) {
                window.alert('inMarker can\'t be the same as outMarker');
            }
            else if (type === 'inFrame' && currentMarkerPosition > this.model.get('outFrame')) {
                window.alert('inMarker can\'t be higher than outMarker');
            }
            else if (type === 'outFrame' && currentMarkerPosition < this.model.get('inFrame')) {
                window.alert('outMarker can\'t be lower than inMarker');
            }
            else {
                this.model.set(type, currentMarkerPosition);
                //update view
                this.updateMarkerButtons();
            }

        },

        updateMarkerButtons : function () {
            "use strict";
            var $in = this.$('button[data-cmd="jumpToIn"]'),
                $out = this.$('button[data-cmd="jumpToOut"]');

            $in.text('Go to In-Marker (' + this.model.get('inFrame') + ')');
            $out.text('Go to Out-Marker (' + this.model.get('outFrame') + ')');
        },

        jumpTo : function (frame) {
            "use strict";
            if (this.isReady()) {
                this.video.currentTime = frame / this.model.get('fps');
            }

        },

        isReady : function () {
            "use strict";
            return this.video.readyState === this.video.HAVE_FUTURE_DATA || this.video.readyState === this.video.HAVE_ENOUGH_DATA;
        },

        destroy : function () {
            "use strict";
            this.video.pause();
            delete(this.video);
            this.$el.remove();
        }

    });


})
;