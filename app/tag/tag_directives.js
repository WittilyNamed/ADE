/* ==================================================================
AngularJS Datatype Editor - Tag
A directive to pick multiple values from a list or add a new value

This directive uses a modified version of ngTagsInput
http://mbenford.github.io/ngTagsInput

You will need to include ngTagsInput as a dependency to your app

Usage:
<div ade-tag="list1" ade-id="123" ade-query="query(val,listId)" ng-model="data"></div>

Config:

ade-tag:
	The id number for the type of list. If you have multiple lists per page, this will
	distinguish between them
ade-id:
	If this id is set, it will be used in messages broadcast to the app on state changes.
ade-readonly:
	If you don't want the list to be editable	
ade-query:
	A function in your controller that will provide matches for search query.
	The argument names need to match

 Messages:
 name: ADE-start
 data: id from config

 name: ADE-finish
 data: {id from config, old value, new value, exit value}

 ------------------------------------------------------------------*/

angular.module('ADE').directive('adeTag', 
 ['ADE', '$compile', '$filter', '$sanitize', 
 function(ADE, $compile, $filter, $sanitize) {
	return {
		require: '?ngModel', //optional dependency for ngModel
		restrict: 'A', //Attribute declaration eg: <div ade-toggle=""></div>

		scope: {
			adeTag: "@",
			adeId: "@",
			adeClass: "@",
			adeQuery: "&",
			adeReadonly: "@",
			ngModel: "="
		},

		//The link step (after compile)
		link: function(scope, element, attrs) {
			var editing = false; //are we in edit mode or not
			var input = null; //a reference to the input DOM object
			var readonly = false;
			var exit = 0; //0=click, 1=tab, -1= shift tab, 2=return, -2=shift return, 3=esc. controls if you exited the field so you can focus the next field if appropriate
			var stopObserving = null;
			var adeId = scope.adeId;
			var tagPicker = null; //the added div with all the stuff in it

			if(scope.adeReadonly!==undefined && scope.adeReadonly=="1") readonly = true;

			scope.query = function(val) { //called by ng-tags-input on each keystroke to get the autocomplete
				setTimeout(function() { //need to give it time to render the extra height before moving it
					var items = $("auto-complete .suggestion-list li");
					if(items.length==0) {
						$('.ade-tag-suggestion').hide();
						$('.ade-tag-emptytip').show();
					} else {
						$('.ade-tag-suggestion').show();
						$('.ade-tag-emptytip').hide();
					}
				},100);

				var promise = scope.adeQuery({val:val, listId: scope.adeTag});
				return promise;
			};
			scope.esc = function() { //called by ng-tags-input when esc key is pressed 
				destroy();
				ADE.done(adeId, scope.ngModel, scope.ngModel, 3);
			};
			scope.ret = function(e) {
				var exit = e.shiftKey ? -2 : 2;
				saveEdit(exit);
			};
			scope.tab = function(e) {
				var exit = e.shiftKey ? -1 : 1;
				saveEdit(exit);
			};
			scope.blurred = function(how) {
				saveEdit(how);
			};


			//generates HTML for the tag in read mode
			var makeHTML = function() {
				var html = "";

				if (scope.ngModel!==undefined) {
					if (angular.isString(scope.ngModel)) {
						html = scope.ngModel;
					} else if (angular.isArray(scope.ngModel)) {
						var html = '';
						$.each(scope.ngModel, function(i, v) {
							if (html) html += ', ';
							html += v;
						});
					}
				}
				html = $sanitize(html).replace(/<[^>]+>/gm, '');
				element.html(html);
			}

			//called once the edit is done, so we can save the new data and remove edit mode
			var saveEdit = function(exited) {
				var oldValue = scope.ngModel;
				exit = exited;
				if (exited != 3) { //don't save value on esc
					var value = scope.tags;
					if (angular.isArray(value)) {
						if (value.length > 0) {
							//to have value stored as array
							var vals = [];
							angular.forEach(value, function(val, key) {
								if(val.text) vals.push(val.text);
							});
							value = vals;
						} else {
							value = null;
						}
					} else if (angular.isObject(value) && value.text) {
						value = value.text;
					} else {
						value = (value) ? value.text : null;
					}

					scope.ngModel = value;
				}

				destroy();

				ADE.done(adeId, oldValue, scope.ngModel, exit);
			};


			var clickHandler = function(e) {
				if (editing) return;
				editing = true;
				exit = 0;

				adeId = scope.adeId;
				ADE.begin(adeId);

				var autocomplete = "query($query)";

				scope.tags = angular.copy(scope.ngModel);
				if (angular.isString(scope.tags)) scope.tags = scope.tags.split(',');
				if(!angular.isArray(scope.tags)) scope.tags = [];
				
				var html = '<div class="' + ADE.popupClass + ' ade-tags dropdown-menu open">';
					html += '<tags-input class="ade-tag-input" ng-model="tags" min-length="1" replace-spaces-with-dashes="false" enable-editing-last-tag="true" on-esc-key="esc()" on-ret-key="ret(e)" on-blurred="blurred(how)" focus-on-load="true">';
					html += '<div class="ade-tag-suggestion">Suggestions:</div><div class="ade-tag-emptytip">Type in a new tag and press return</div><auto-complete source="'+autocomplete+'" min-length="1" load-on-empty="true" load-on-focus="true"></auto-complete>';
					html += '</tags-input></div>';
				$compile(html)(scope).insertAfter(element);
				
				place();
				setTimeout(function() { //need to give it time to render before moving it
					place();
				});

				tagPicker = element.next('.ade-tags').find('.ade-tag-input');

				tagPicker.on("keydown",function(e) { //prevent tab key from doing default behavior
					if (e.keyCode == 9) { //tab
						e.preventDefault();
						e.stopPropagation();
						input.blur();
					}
				});

				ADE.setupScrollEvents(element,function() {
					scope.$apply(function() {
						place();
					});
				});

				setTimeout(function() {
					input = tagPicker.find('.tag-list + input');
				},100); //tag input needs little time to initialize before it can accept a focus

			};

			//place the popup in the proper place on the screen
			var place = function() {
				ADE.place('.'+ADE.popupClass,element,0,15);
			};

			var focusHandler = function(e) {
				element.on('keypress.ADE', function(e) {
					if (e.keyCode == 13) { //return
						e.preventDefault();
						e.stopPropagation();
						element.click();
					}
				});
			};
			
			//setup events
			if(!readonly) {
				element.on('click.ADE', function(e) {
					scope.$apply(function() {
						clickHandler(e);
					})
				});
				element.on('focus.ADE',  function(e) {
					scope.$apply(function() {
						focusHandler(e);
					})
				});
				element.on('blur.ADE', function(e) {
					element.off('keypress.ADE');
				});
			}


			//A callback to observe for changes to the id and save edit
			//The model will still be connected, so it is safe, but don't want to cause problems
			var observeID = function(value) {
				 //this gets called even when the value hasn't changed, 
				 //so we need to check for changes ourselves
				 if(editing && adeId!==value) saveEdit(3);
			};

			//If ID changes during edit, something bad happened. No longer editing the right thing. Cancel
			stopObserving = attrs.$observe('adeId', observeID);

			var destroy = function() {
				ADE.hidePopup();
				ADE.teardownScrollEvents(element);

				if(input) input.off();
				if(tagPicker && tagPicker.length) {
					tagPicker.off();
					tagPicker.remove();
				}
				ADE.teardownBlur();

				editing = false;
			};

			scope.$on('$destroy', function() { //need to clean up the event watchers when the scope is destroyed
				destroy();

				if(element) {
					element.off('click.ADE');
					element.off('focus.ADE');
					element.off('blur.ADE');
					element.off('keypress.ADE');
				}

				if(stopObserving && stopObserving!=observeID) { //Angualar <=1.2 returns callback, not deregister fn
					stopObserving();
					stopObserving = null;
				} else {
					delete attrs.$$observers['adeId'];
				}
			});
			
			//need to watch the model for changes
			scope.$watch(function(scope) {
				return scope.ngModel;
			}, function () {
				makeHTML();
			});

		}
	};
}]);