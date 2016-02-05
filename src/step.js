angular.module('mgo-angular-wizard').directive('wzStep', function() {
    'use strict';
    return {
        restrict: 'EA',
        replace: true,
        transclude: true,
        scope: {
            wzTitle: '@',
            canenter : '=',
            canexit : '=',
            disabled: '@?wzDisabled',
            description: '@',
            wzData: '='
        },
        require: '^wizard',
        templateUrl: function(element, attributes) {
          return attributes.template || "step.html";
        },
        link: function($scope, $element, $attrs, wizard) {
            initializeStep();
            $scope.title = $scope.wzTitle;
            wizard.addStep($scope);

            function initializeStep () {
                    $scope.hide = true;
                    $scope.active = $scope.done = false;
                    if($scope.editMode){
                        $scope.done = true;
                    }
            }
        }
    };
});
