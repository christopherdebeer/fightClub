
// Usage
//
// **************************************************
//
// $(document).ready(function()
// {
// 	$('canvas').pacman({
// 		data: [
// 			{ colour: '#FF0000', degrees: 0 },
// 			{ colour: '#dddddd', degrees: 360 }
// 		]
// 	});
// });

(function($)
{
	$.fn.pacman = function(options)
	{
		options = $.extend({
			data: [],
			height: 300,
			width: 300,
			duration: 10000,
			fps: 24,
			onRotate: $.noop,
			onStep: $.noop,
            retina: false
		}, options);

		/**
		* Calculates the total number of degrees
		* 
		* @param {Object} data
		* @return {Number}
		*/
		function getTotal(data)
		{
			var total = 0;

			for(var i=0; i < data.length; i++)
				total+= data[i].degrees 

			return total;
		}

		/**
		* Clears the context
		* 
		* @param {CanvasRenderingContext2D} context
		*/
		function clear(context)
		{
			context.clearRect(0, 0, options.width, options.height);
		}

		/**
		* Renders arcs on context
		* 
		* @param {CanvasRenderingContext2D} context
		* @param {Object} data
		*/
		function plot(context, data)
		{
			var j = 0,
				total = getTotal(data);

			// clear the canvas
			clear(context);

			for(var i in data) 
			{
				var d = Math.PI * 2 * (data[i].degrees / total);

				context.fillStyle = data[i].colour;
				context.beginPath();
				context.moveTo(options.width / 2, options.height / 2);
				context.arc(options.width / 2, options.height / 2, options.height / 2, j, j + d, true);
				context.lineTo(options.width / 2, options.height / 2);
				context.fill();
				context.closePath();
				j+= d;
			}
		}

		return this.each(function()
		{
			var $this = $(this),
				context = this.getContext('2d');
            
            this.style.height = options.height;
            this.style.width = options.width;
            
			if (options.retina) {
                
                options.height = options.height * 2;
                options.width = options.width * 2;
            
            }
            
            this.height = options.height;
			this.width = options.width;
            
            
            
			plot(context, options.data);
			
			// rotate 270deg
			context.translate(0, options.height);
			context.rotate(270 * Math.PI/180);

			var tmp = 0;
			
			function update(tmp2)
			{
				tmp = tmp >= 360 || tmp <= 0 ? 0 : tmp; tmp+= tmp2;
				
				var degs = [tmp, (360 - tmp)];

				plot(context, [
					{ colour: options.data[1].colour, degrees: degs[0] },
					{ colour: options.data[0].colour, degrees: degs[1] }
				]);
			}

			//setInterval(update, 24 / 1000); // 24fps
			
			function doTimer(duration, fps, oninstance, oncomplete)
			{
				var steps = (duration / 100) * (fps / 10),
					speed = duration / steps,
					count = 0,
					start = new Date().getTime();
				
				function instance()
				{
					if(count++ == steps)
					{
						oncomplete(steps, count);
					}
					else
					{
						oninstance(steps, count);
						var diff = (new Date().getTime() - start) - (count * speed);
						window.setTimeout(instance, (speed - diff));
					}
				}
				window.setTimeout(instance, speed);
			}
			
			var active = 0, stopInstant = false;
			
			$this.data({
				stop: function(instant)
				{
					stopInstant = instant || false;
					
					active = 0;
				},
				start: function()
				{
					active = 1;
					stopInstant = false;
					fire();
				},
				reset: function()
				{
					tmp = 0;
					update(0);
				}
			})
			
			function fire()
			{
				doTimer(options.duration, options.fps, function(steps, count)
				{
					if(!active && stopInstant)
						return;
					
					update(360 / steps);
					options.onStep(steps, count);
				}, 
				function(steps, count)
				{
					if(!active)
						return;
					
					fire();
					options.onRotate(steps, count);
				})
			}
			
			$this.data('start')();
		});
	};
}
(jQuery));