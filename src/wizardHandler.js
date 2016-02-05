angular.module('mgo-angular-wizard').factory('WizardHandler', function() {
   var wizards ={},
   service = {
      addWizard : addWizard,
      removeWizard: removeWizard,
      wizard: wizard,
      defaultName: "defaultWizard"
   };   
   
   return service;
   
   function addWizard(name, wizard) {
       wizards[name] = wizard;
   }
   
   function removeWizard(name) {
       delete wizards[name];
   }
   
   function wizard (name) {
       var nameToUse = name;
       if (!name) {
           nameToUse = service.defaultName;
       }
       
       return wizards[nameToUse];
   }
});
