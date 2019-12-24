var eventBus = require('ocore/event_bus.js')
var crud = require('./crud.js')
var objectHash = require('ocore/object_hash.js');

function onError(err){
	throw Error(err);
}

function createAttestation(headlessWallet, deviceAddr, useraddr, device){
  var user = crud.getUserData(deviceAddr)
	var composer = require('ocore/composer.js');
	var network = require('ocore/network.js');
	var callbacks = composer.getSavingCallbacks({
		ifNotEnoughFunds: onError,
		ifError: onError,
		ifOk: function(objJoint){
      console.error('objjoint...')
      console.error(objJoint.unit.unit)
			network.broadcastJoint(objJoint);
      crud.userAttested(deviceAddr, device, objJoint.unit.unit)
		}
	});
	
	var profile = {
    user: user.userid,
    username: user.username,
    hash: objectHash.getBase64Hash([user.userid])
	};
	composer.composeAttestationJoint(
		"3BKLY6TTEVYLCLXNXFWGRSPWZE6HEDGK", // attestor address
		useraddr, // address of the person being attested (subject)
		profile,                            // attested profile
		headlessWallet.signer, 
		callbacks
	);
}
module.exports = {
  createAttestation
}
