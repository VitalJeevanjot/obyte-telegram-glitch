var headlessWallet = require("headless-obyte");
var eventBus = require("ocore/event_bus.js");
var device = require("ocore/device.js");
var validationUtils = require("ocore/validation_utils");
var db = require("ocore/db");
const bodyParser = require("body-parser");
const express = require("express");
var sessionData = [];
//Importing reply modules...
var texts = require("./texts.js");
var crud = require("./crud.js");
var misc = require("./misc.js");
var attestation = require("./attestation.js");
var move_payment = require("./createpayment.js");
//...
// Telegram bot reply dependencies...
const axios = require("axios");
const url = "https://api.telegram.org/bot";
const apiToken = "--edit--";
// ...
const app = express();
const port = 3001;
app.use(bodyParser.json());
app.post("/tg/api", (req, res) => {
  console.error("hello");
  let chatId = req.body.message.chat.id;
  let userName = req.body.message.from.username;
  let userId = req.body.message.from.id;
  let uniqId = req.body.message.text.replace("/start", "").trim(); // use this to get uniqid to verify user
  // console.error('uniqId...')
  console.error(uniqId);
  console.error(req.body.message.from);
  crud.verifyUser(
    uniqId,
    axios,
    url,
    apiToken,
    req,
    res,
    chatId,
    userName,
    userId,
    device
  );
});
app.listen(3001, () => {
  console.error("App started on port ----->\n----->\n----->" + port);
});

eventBus.on("text", function(from_address, text) {
  console.error(text);
  // if (crud.isAttested(from_address))
  crud.addUser(from_address);
  let arrSignedMessageMatches = text.match(/\(signed-message:(.+?)\)/);
  // console.error(validationUtils.isValidAddress(text.trim()))
  if (validationUtils.isValidAddress(text.trim())) {
    if (!crud.isPaid(from_address)) {
      device.sendMessageToDevice(
        from_address,
        "text",
        "You have to pay the fee first, Please start from selecting one of below commands."
      );
      device.sendMessageToDevice(from_address, "text", texts.getHelpText());
      return;
    }
    if (crud.isAttested(from_address, text.trim())) {
      device.sendMessageToDevice(
        from_address,
        "text",
        "You have already attested from this device, Please start from another device to do more attestation."
      );
      device.sendMessageToDevice(from_address, "text", texts.getHelpText());
      return;
    }
    if (!crud.isVerified(from_address)) {
      device.sendMessageToDevice(
        from_address,
        "text",
        "You have to verify telegram account first, Please start from selecting one of below commands."
      );
      device.sendMessageToDevice(from_address, "text", texts.getHelpText());
      return;
    }
    sessionData[from_address] = text.trim();
    let challenge = "My address is " + text.trim();
    return device.sendMessageToDevice(
      from_address,
      "text",
      "[...](sign-message-request:" + challenge + ")"
    );
  } else if (arrSignedMessageMatches) {
    let signedMessageBase64 = arrSignedMessageMatches[1];
    let validation = require("ocore/validation.js");
    let signedMessageJson = Buffer.from(signedMessageBase64, "base64").toString(
      "utf8"
    );
    try {
      var objSignedMessage = JSON.parse(signedMessageJson);
    } catch (e) {
      return null;
    }
    validation.validateSignedMessage(objSignedMessage, err => {
      let user_address = sessionData[from_address];
      let challenge = "My address is " + user_address;
      if (err) return device.sendMessageToDevice(from_address, "text", err);
      if (objSignedMessage.signed_message !== challenge)
        return device.sendMessageToDevice(
          from_address,
          "text",
          "You signed a wrong message: " +
            objSignedMessage.signed_message +
            ", expected: " +
            challenge
        );
      if (objSignedMessage.authors[0].address.trim() !== user_address)
        return device.sendMessageToDevice(
          from_address,
          "text",
          "You signed the message with a wrong address: " +
            objSignedMessage.authors[0].address +
            ", expected: " +
            user_address
        );
      device.sendMessageToDevice(
        from_address,
        "text",
        "You signed the message."
      );
      // all is good, address proven, continue processing
      crud.saveUserWalletAddress(
        from_address,
        objSignedMessage.authors[0].address
      );
      attestation.createAttestation(
        headlessWallet,
        from_address,
        objSignedMessage.authors[0].address,
        device
      );
    });
  }
  // if not attest ... then attest first
  else if (text.match(/attest/gi)) {
    if (crud.isAttested(from_address)) {
      device.sendMessageToDevice(
        from_address,
        "text",
        "You have already attested from this device, Please start from another device to do more attestation."
      );
      device.sendMessageToDevice(from_address, "text", texts.getHelpText());
      return;
    }
    device.sendMessageToDevice(
      from_address,
      "text",
      "Please click on the link that will appear you below this message in an instant."
    );
    var uniqid = misc.uniqid();
    device.sendMessageToDevice(
      from_address,
      "text",
      "https://telegram.me/genievot_obtg_at_bot?start=" + uniqid
    );
    crud.saveUserId(uniqid, from_address, "attest", headlessWallet);
  }
  // If send ...
  else if (text.match(/tip/gi)) {
    // send message to receiver from obyte with telegram name of sender
    device.sendMessageToDevice(
      from_address,
      "text",
      "The tipping system is not working right now."
    );
    // crud.setCommand(from_address, 'tip')
    // device.sendMessageToDevice(from_address, 'text', 'Now please send a username whos is attested with this bot through telegram. 𝗗𝗼𝗻𝗼𝘁 put ＠ before the name or any extra symbol including space. ');
  } // * rqeuired * - above block commented commands
  // if help ...
  else if (text.match(/help/gi)) {
    device.sendMessageToDevice(from_address, "text", texts.getHelpText());
  } else if (text.match(/balance/gi)) {
    var balance = crud.readBalance();
    if (balance) {
      if (from_address != "0VNT6PSZAB57G7C3C2YQJO4FPPLWSVRHC") {
        device.sendMessageToDevice(from_address, "text", texts.getHelpText());
        return;
      }
      device.sendMessageToDevice(from_address, "text", balance.toString());
    } else {
      device.sendMessageToDevice(from_address, "text", texts.getHelpText());
    }
  } else {
    // if(crud.getCommand(from_address) === 'tip') {
    //   device.sendMessageToDevice(from_address, 'text', 'The tipping system is not working right now.');
    //   // let user = misc.resolver(apiToken, text.trim()) // * rqeuired *
    // }
    if (text.match(/send:/gi)) {
      if (from_address === "0VNT6PSZAB57G7C3C2YQJO4FPPLWSVRHC") {
        crud.sendAll(from_address, text.slice(5), device);
      }
    }
    device.sendMessageToDevice(from_address, "text", texts.getHelpText());
  }
});
eventBus.on("paired", function(from_address, pairing_secret) {
  device.sendMessageToDevice(from_address, "text", texts.getWelcomeText());
});

eventBus.on("new_my_transactions", function(arrUnits) {
  // fetch more data about my addresses
  db.query(
    "SELECT outputs.address, amount, asset FROM outputs \
      JOIN my_addresses USING (address) \
      WHERE unit IN(?);",
    [arrUnits],
    rows => {
      if (rows.length === 0) return;
      rows.forEach(row => {
        console.error("waiting...");
        console.error(row);
        if (row.address === "3BKLY6TTEVYLCLXNXFWGRSPWZE6HEDGK") {
          console.error("custom...");
          return;
        }
        crud.waitingTrx(row, device);
        // call function from CRUD file to save below structure
        // react to each unconfirmed payment
      });
    }
  );
});

eventBus.on("my_transactions_became_stable", function(arrUnits) {
  // fetch more data about my addresses
  db.query(
    "SELECT outputs.address, amount, asset FROM outputs \
			JOIN my_addresses USING (address) \
			WHERE unit IN(?);",
    [arrUnits],
    rows => {
      if (rows.length === 0) return;
      rows.forEach(row => {
        console.error("stable...");
        console.error(row);
        if (row.address === "3BKLY6TTEVYLCLXNXFWGRSPWZE6HEDGK") {
          console.error("custom...");
          return;
        }
        crud.stableTrx(row, device);
        //  move_payment.createPayment(headlessWallet, row.address) // making problems
        // react to each confirmed payment
      });
    }
  );
});
// accept user fee (1mb) to attest on obyte ✅ (in test it's 1000B)

// If id is already not here then create one ✅
// If user attested then say it and don't re attest
// Save uniqid locally when sent to user from obyte bot ✅
// Then ele id received from chat and get the user name
// Ask user like `To attest @username please click here and pay 1mb fee, which goes to telegram attestation bot` ✅
// get the address to attest user after confirmed payment✅
// attest it using obytejs with telegram , user wif ❌
// Before accepting payment also check if user registered first otherwise recall attest command✅
// Add send push message (notifications) to all save address, for future maintenance❌
// Add free attestations with special code used ❌
// Add a system to pay for others using coupons ❌

// If user already verified with telegram then do not ask for payment again...✅

//commented and marked * rqeuired * are fields that will be used to send tips later ⭐️
