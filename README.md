![CCCCombo!!](https://github.com/christopherdebeer/CCCCombo.js/raw/master/public/img/combo.png)

This is a work in progress, eventually a mobile gesture pattern registering library.
© Christopher de Beer 2012

Hit Areas
---------

Hit areas or button ID's are assigned to elements as `data-combo-id` attributes like so

	<a href="#" class="btn" data-combo-id="A">A Button</a>
	<a href="#" class="btn" data-combo-id="B">B Button</a>

Combo Definition
---------------

Combos are supplied as objects containing an `id`, a `desc`, and `moves` assosiated with the combo, and each move can either have a direction or area or both (Both are arrays, ie: options). For example hitting button `A` three times in a row, is done like so

	{
		id: "example",
		desc: "Example Combo!",
		moves: [
			{area: ["A"], dir: "tap"},
			{area: ["A"], dir: "tap"},
			{area: ["A"], dir: "tap"},
		]
	}

A combo can have a direction but no assosiated Area (Button), thus working on all buttons. The below combo would work on all buttons and can be activated by either doing the movement equal to: "Left Down Right Up" or "Right Up Left Down".

	{
		id: "example2",
		desc: "Reverse RoundHouse!!",
		moves: [
			{dir: ["ldru", "ruld"]}
		]
	}

Directions
---------

Possible directions for a combo move are:

	"l" 	: Left
	"r" 	: Right
	"d" 	: Down
	"u" 	: Up
	"tap" 	: Tap
	"Dtap" 	: Double Tap



Usage
------

	$('a.btn').CCCCombo({

		// callback
		onCombo: function(combo){
			// do something with results
		},

		// register your combo combinations
		combos: [
			{
				id: "00001",
				desc: "A basic combo"
				moves: [
					{area: ["A"], dir: ["Dtap"]},
					{area: ["B"], dir: ["tap"]}
				]
			},
			{
				id: "00002",
				desc: "Reverse RoundHouse!!",
				moves: [
					{dir: ["ldru", "ruld"]}
				]
			}
		]
	});


Options
--------

	$('a').CCCComo({
		onCombo: function(combo) {}, // callback
		combos: [], 				 // an array of your prefeined combos to check against
		comboTimeout: 1000,			 // timeout for linking moves into a combo
		tapTimeout: 100,			 // timout for taps to register as individual taps
	})


If the elements that are being used as Hit Areas don't have a predefined `data-combo-id` attribute then one will be assigned based on it's index. (though its better to predefine them otherwise your combo definitions would be rather pointless).