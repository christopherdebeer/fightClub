var bot = {

	random: {

		opts: ["tL","tM","tR","mL","mM","mR","bL","bM","bR"],
		num: function(min,max) {

			if (min === 0 && max === 1) {
				return (Math.random() * (max) + min) > 0.5 ? 1 : 0;
			} else {
				return Math.floor(Math.random() * (max) + min);	
			}
			
		},
		attack: function(){
			return {
				id: this.opts[Math.floor(Math.random() * (this.opts.length-1))],
				dir: "tap",
				type: "punch"
			};
		},

		block: function(){
			return {
				id: this.opts[Math.floor(Math.random() * (this.opts.length-1))],
				dir: "Dtap",
				type: "block"
			};
		},

	},

	// blocks four random areas per turn - no attacks
	blockOnly: 	{
		hp: {
			current: 200,
			max: 200
		},
		ap: 4,
		type: "bot",
		dmg: 5,
		currentMoves: [],
		moveHistory: [],
		getTurn: function(){
			
			var blocks = [],
				attacks = [];
			
			for (x=0; x<this.ap; x++) blocks.push(bot.random.block());

			return _.union(blocks,attacks);
		}
	},

	// blocks four random areas per turn - no attacks
	attackOnly: {
		hp: {
			current: 200,
			max: 200
		},
		ap: 4,
		type: "bot",
		dmg: 5,
		currentMoves: [],
		moveHistory: [],
		getTurn: function(){
			
			var blocks = [],
				attacks = [];
			
			for (x=0; x<this.ap; x++) {
				attacks.push(bot.random.attack());
			}

			return _.union(blocks,attacks);
		}
	},
	attackAndBlock: {
		hp: {
			current: 200,
			max: 200
		},
		ap: 4,
		type: "bot",
		dmg: 5,
		currentMoves: [],
		moveHistory: [],
		getTurn: function(){
			
			var blocks = [],
				attacks = [];
			
			for (x=0; x<this.ap; x++) {
				var randomInt = bot.random.num(0,1);
				//console.log("random int: ", randomInt)
				if (randomInt) attacks.push(bot.random.attack());
				else blocks.push(bot.random.block());
			}

			return _.union(blocks,attacks);
		}
	}
}