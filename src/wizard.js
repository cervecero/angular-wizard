//wizard directive
angular.module('mgo-angular-wizard').directive('wizard', function() {
    'use strict';
    return {
        restrict: 'EA',
        replace: true,
        transclude: true,
        scope: {
            currentStep: '=',
            onFinish: '&',
            hideIndicators: '=',
            editMode: '=',
            name: '@'
        },
        templateUrl: function(element, attributes) {
            return attributes.template || "wizard.html";
        },

        //controller for wizard directive, treat this just like an angular controller
        controller: ['$scope', '$element', '$log', 'WizardHandler', '$q', function($scope, $element, $log, WizardHandler, $q) {
            //this variable allows directive to load without having to pass any step validation
            var firstRun = true, that = this;

            that.addStep = addStep;
            that.currentStepTitle = currentStepTitle;
            that.currentStepDescription = currentStepDescription;
            that.currentStep = currentStep;
            that.totalStepCount = totalStepCount;
            that.getEnabledSteps = _getEnabledSteps;
            that.currentStepNumber = _currentStepNumber;
            that.next = next;
            that.goTo = _goTo;
            that.finish = finish;
            that.previous = previous;
            that.cancel = cancel;
            that.reset = reset;

            //steps array where all the scopes of each step are added
            $scope.steps = [];
            //access to context object for step validation
            $scope.context = {};
            $scope.getStepNumber = getStepNumber;
            $scope.goTo = goTo;
            $scope.getEnabledSteps = getEnabledSteps;
            $scope.currentStepNumber = currentStepNumber;

            var stepIdx = function(step) {
                var idx = 0;
                var res = -1;
                angular.forEach($scope.getEnabledSteps(), function(currStep) {
                  if (currStep === step) {
                    res = idx;
                  }
                  idx++;
                });
                return res;
            };

            var stepByTitle = function(titleToFind) {
              var foundStep = null;
              angular.forEach($scope.getEnabledSteps(), function(step) {
                if (step.wzTitle === titleToFind) {
                  foundStep = step;
                }
              });
              return foundStep;
            };


            $scope.$on('$destroy', function() {
                WizardHandler.removeWizard($scope.name || WizardHandler.defaultName);
            });

            //watching changes to currentStep
            $scope.$watch('currentStep', function(step) {
                //checking to make sure currentStep is truthy value
                if (!step) return;
                //setting stepTitle equal to current step title or default title
                var stepTitle = $scope.selectedStep.wzTitle;
                if ($scope.selectedStep && stepTitle !== $scope.currentStep) {
                    //invoking goTo() with step title as argument
                    $scope.goTo(stepByTitle($scope.currentStep));
                }

            });

            //watching steps array length and editMode value, if edit module is undefined or null the nothing is done
            //if edit mode is truthy, then all steps are marked as completed
            $scope.$watch('[editMode, steps.length]', function() {
                var editMode = $scope.editMode;
                if (angular.isUndefined(editMode) || (editMode === null)) return;

                if (editMode) {
                    angular.forEach($scope.getEnabledSteps(), function(step) {
                        step.completed = true;
                    });
                } else {
                    var completedStepsIndex = $scope.currentStepNumber() - 1;
                    angular.forEach($scope.getEnabledSteps(), function(step, stepIndex) {
                        if(stepIndex >= completedStepsIndex) {
                            step.completed = false;
                        }
                    });
                }
            }, true);

            //creating instance of wizard, passing this as second argument allows access to functions attached to this via Service
            WizardHandler.addWizard($scope.name || WizardHandler.defaultName, that);


            this.context = $scope.context;

            function getStepNumber(step) {
                return stepIdx(step) + 1;
            }

            function goTo(step) {
                //if this is the first time the wizard is loading it bi-passes step validation
                if(firstRun){
                    //deselect all steps so you can set fresh below
                    unselectAll();
                    $scope.selectedStep = step;
                    //making sure current step is not undefined
                    if (!angular.isUndefined($scope.currentStep)) {
                        $scope.currentStep = step.wzTitle;
                    }
                    //setting selected step to argument passed into goTo()
                    step.selected = true;
                    //emit event upwards with data on goTo() invoktion
                    $scope.$emit('wizard:stepChanged', {step: step, index: stepIdx(step)});
                    //setting variable to false so all other step changes must pass validation
                    firstRun = false;
                } else {
                    //createing variables to capture current state that goTo() was invoked from and allow booleans
                    var thisStep;
                    //getting data for step you are transitioning out of
                    if($scope.currentStepNumber() > 0){
                        thisStep = $scope.currentStepNumber() - 1;
                    } else if ($scope.currentStepNumber() === 0){
                        thisStep = 0;
                    }
                    //$log.log('steps[thisStep] Data: ', $scope.getEnabledSteps()[thisStep].canexit);
                    $q.all([canExitStep($scope.getEnabledSteps()[thisStep], step), canEnterStep(step)]).then(function(data) {
                        if(data[0] && data[1]){
                            //deselect all steps so you can set fresh below
                            unselectAll();

                            //$log.log('value for canExit argument: ', $scope.currentStep.canexit);
                            $scope.selectedStep = step;
                            //making sure current step is not undefined
                            if(!angular.isUndefined($scope.currentStep)){
                                $scope.currentStep = step.wzTitle;
                            }
                            //setting selected step to argument passed into goTo()
                            step.selected = true;
                            //emit event upwards with data on goTo() invoktion
                            $scope.$emit('wizard:stepChanged', {step: step, index: stepIdx(step)});
                            //$log.log('current step number: ', $scope.currentStepNumber());
                        }
                    });
                }
            }

            function canEnterStep(step) {
                var defer,
                    canEnter;
                //If no validation function is provided, allow the user to enter the step
                if(step.canenter === undefined){
                    return true;
                }
                //If canenter is a boolean value instead of a function, return the value
                if(typeof step.canenter === 'boolean'){
                    return step.canenter;
                }
                //Check to see if the canenter function is a promise which needs to be returned
                canEnter = step.canenter($scope.context);
                if(angular.isFunction(canEnter.then)){
                    defer = $q.defer();
                    canEnter.then(function(response){
                        defer.resolve(response);
                    });
                    return defer.promise;
                } else {
                    return canEnter === true;
                }
            }

            function canExitStep(step, stepTo) {
                var defer,
                    canExit;
                //Exiting the step should be allowed if no validation function was provided or if the user is moving backwards
                if(typeof(step.canexit) === 'undefined' || $scope.getStepNumber(stepTo) < $scope.currentStepNumber()){
                    return true;
                }
                //If canexit is a boolean value instead of a function, return the value
                if(typeof step.canexit === 'boolean'){
                    return step.canexit;
                }
                //Check to see if the canexit function is a promise which needs to be returned
                canExit = step.canexit($scope.context);
                if(angular.isFunction(canExit.then)){
                    defer = $q.defer();
                    canExit.then(function(response){
                        defer.resolve(response);
                    });
                    return defer.promise;
                } else {
                    return canExit === true;
                }
            }

            function currentStepNumber() {
                //retreive current step number
                return stepIdx($scope.selectedStep) + 1;
            }

            function getEnabledSteps() {
                return $scope.steps.filter(function(step){
                    return step.disabled !== 'true';
                });
            }

            //unSelect All Steps
            function unselectAll() {
                //traverse steps array and set each "selected" property to false
                angular.forEach($scope.getEnabledSteps(), function (step) {
                    step.selected = false;
                });
                //set selectedStep variable to null
                $scope.selectedStep = null;
            }

            //ALL METHODS ATTACHED TO this ARE ACCESSIBLE VIA WizardHandler.wizard().methodName()
            //called each time step directive is loaded
            function addStep(step) {
                //pushing the scope of directive onto step array
                $scope.steps.push(step);
                //if this is first step being pushed then goTo that first step
                if ($scope.getEnabledSteps().length === 1) {
                    //goTo first step
                    $scope.goTo($scope.getEnabledSteps()[0]);
                }
            }

            function currentStepTitle(){
                return $scope.selectedStep.wzTitle;
            }

            function currentStepDescription(){
                return $scope.selectedStep.description;
            }

            function currentStep(){
                return $scope.selectedStep;
            }

            function totalStepCount() {
                return $scope.getEnabledSteps().length;
            }

            //Access to enabled steps from outside
            function _getEnabledSteps(){
                return $scope.getEnabledSteps();
            }

            //Access to current step number from outside
            function _currentStepNumber(){
                return $scope.currentStepNumber();
            }
            
            //method used for next button within step
            function next(callback) {
                var enabledSteps = $scope.getEnabledSteps();
                //setting variable equal to step  you were on when next() was invoked
                var index = stepIdx($scope.selectedStep);
                //checking to see if callback is a function
                if(angular.isFunction(callback)){
                   if(callback()){
                        if (index === enabledSteps.length - 1) {
                            this.finish();
                        } else {
                            //invoking goTo() with step number next in line
                            $scope.goTo(enabledSteps[index + 1]);
                        }
                   } else {
                        return;
                   }
                }
                if (!callback) {
                    //completed property set on scope which is used to add class/remove class from progress bar
                    $scope.selectedStep.completed = true;
                }
                //checking to see if this is the last step.  If it is next behaves the same as finish()
                if (index === enabledSteps.length - 1) {
                    this.finish();
                } else {
                    //invoking goTo() with step number next in line
                    $scope.goTo(enabledSteps[index + 1]);
                }

            }

            //used to traverse to any step, step number placed as argument
            function _goTo(step) {
                var enabledSteps = $scope.getEnabledSteps();
                var stepTo;
                //checking that step is a Number
                if (angular.isNumber(step)) {
                    stepTo = enabledSteps[step];
                } else {
                    //finding the step associated with the title entered as goTo argument
                    stepTo = stepByTitle(step);
                }
                //going to step
                $scope.goTo(stepTo);
            }

            //calls finish() which calls onFinish() which is declared on an attribute and linked to controller via wizard directive.
            function finish() {
                if ($scope.onFinish) {
                    $scope.onFinish();
                }
            }
            
            function previous() {
                //getting index of current step
                var index = stepIdx($scope.selectedStep);
                //ensuring you aren't trying to go back from the first step
                if (index === 0) {
                    throw new Error("Can't go back. It's already in step 0");
                } else {
                    //go back one step from current step
                    $scope.goTo($scope.getEnabledSteps()[index - 1]);
                }
            }

            //cancel is alias for previous.
            function cancel() {
                //getting index of current step
                var index = stepIdx($scope.selectedStep);
                //ensuring you aren't trying to go back from the first step
                if (index === 0) {
                    throw new Error("Can't go back. It's already in step 0");
                } else {
                    //go back one step from current step
                    $scope.goTo($scope.getEnabledSteps()[0]);
                }
            }

            //reset
            function reset(){
                //traverse steps array and set each "completed" property to false
                angular.forEach($scope.getEnabledSteps(), function (step) {
                    step.completed = false;
                });
                //go to first step
                this.goTo(0);
            }
        }]
    };
});