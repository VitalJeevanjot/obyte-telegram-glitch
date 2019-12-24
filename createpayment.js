/*jslint node: true */
"use strict";
var eventBus = require('ocore/event_bus.js');

function onError(err){
	throw Error(err);
}

function createPayment(headlessWallet, addr){
	var composer = require('ocore/composer.js');
	var network = require('ocore/network.js');
	var callbacks = composer.getSavingCallbacks({
		ifNotEnoughFunds: onError,
		ifError: onError,
	/*	preCommitCb: function (conn, objJoint, handle){ //In this optional callback you can add SQL queries to be executed atomically with the payment
						conn.query("UPDATE my_table SET status='paid' WHERE transaction_id=?",[transaction_id]);
						handle();
					},*/
		ifOk: function(objJoint){
			network.broadcastJoint(objJoint);
		}
	});
	
	var from_address = addr;
	var payee_address = "3BKLY6TTEVYLCLXNXFWGRSPWZE6HEDGK";
	var arrOutputs = [
		{address: from_address, amount: 0},      // the change
		{address: payee_address, amount: 2000}  // the receiver
	];
	composer.composePaymentJoint([from_address], arrOutputs, headlessWallet.signer, callbacks);
}

module.exports = {
  createPayment
}
