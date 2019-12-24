const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");

const adapter = new FileSync("db.json");
const db = low(adapter);

db.defaults({ users: [], total: 0, count: 0 }).write();

module.exports = {
  saveUserId: function(uniqid, deviceAddr, command, headlessWallet) {
    if (
      db
        .get("users")
        .find({ deviceAddress: deviceAddr })
        .value()
    ) {
      headlessWallet.issueNextMainAddress(address => {
        db.get("users")
          .find({ deviceAddress: deviceAddr })
          .assign({
            uniqid: uniqid,
            verifiedTelegram: false,
            command: command,
            addressToPaySelf: address
          })
          .write();
      });
    } else {
      exports.addUser(deviceAddr);
      exports.saveUserId(uniqid, deviceAddr);
    }
  },
  addUser: function(deviceAddr) {
    if (
      !db
        .get("users")
        .find({ deviceAddress: deviceAddr })
        .value()
    ) {
      db.get("users")
        .push({
          deviceAddress: deviceAddr,
          verifiedTelegram: false,
          amountConfirmed: 0
        })
        .write();
      db.update("count", n => n + 1).write();
    }
  },
  verifyUser: function(
    uniqid,
    axios,
    url,
    apiToken,
    req,
    res,
    chatid,
    username,
    userid,
    device
  ) {
    let user = db
      .get("users")
      .find({ uniqid: uniqid })
      .value();
    // console.error('user...')
    // console.error(user)
    // console.error('...user')
    if (user) {
      if (user.attested) {
        device.sendMessageToDevice(
          user.deviceAddress,
          "text",
          "You have already attested from this device, Please start from another device to do more attestation, click [help](command:help) to know more."
        );
        axios
          .post(`${url}${apiToken}/sendMessage`, {
            chat_id: chatid,
            text:
              "You can close this now and move to obyte bot to complete process."
          })
          .then(response => {
            res.status(200).send(response);
            // send message to obyte bot from here for payment and attestation
            return true;
          })
          .catch(error => {
            res.send(error);
            return false;
          });
        return
      }

      let user_device_address = user.deviceAddress;
      let addressToPay = user.addressToPaySelf;
      db.get("users")
        .find({ uniqid: uniqid })
        .assign({
          username: username,
          chatId: chatid,
          userid: userid,
          verifiedTelegram: true
        })
        .write();
      device.sendMessageToDevice(user_device_address, "text", "☟ ☟ ☟");
      device.sendMessageToDevice(
        user_device_address,
        "text",
        "Please make below service payment/fees to continue and don not change your telegram username until the process not completes."
      );
      device.sendMessageToDevice(
        user_device_address,
        "text",
        "[...](byteball:" + addressToPay + "?amount=3000&asset=base)"
      );
      axios
        .post(`${url}${apiToken}/sendMessage`, {
          chat_id: chatid,
          text:
            "You can close this now and move to obyte bot to complete process."
        })
        .then(response => {
          res.status(200).send(response);
          // send message to obyte bot from here for payment and attestation
          return true;
        })
        .catch(error => {
          res.send(error);
          return false;
        });
    } else {
      axios
        .post(`${url}${apiToken}/sendMessage`, {
          chat_id: chatid,
          text:
            "You are not registered yet, try from obyte bot.\n byteball:Aya0I3wENXVBkQ1SuR1wLXMOjP66OXEcU+pAKQzliBvI@obyte.org/bb#0000"
        })
        .then(response => {
          res.status(200).send(response);
          // send message to obyte bot from here for payment and attestation
          return false;
        })
        .catch(error => {
          res.send(error);
          return false;
        });
    }
  },
  isVerified: function(deviceAddr) {
    var user = db
      .get("users")
      .find({ deviceAddress: deviceAddr })
      .value();
    if (user) {
      if (user.verifiedTelegram) {
        return true;
      }
    } else {
      return false;
    }
  },
  isAttested: function(deviceAddr, useraddr) {
    // If try any other opration without being attested
    var user = db
      .get("users")
      .find({ deviceAddress: deviceAddr })
      .value();
    var usera = db
      .get("users")
      .find({ useraddress: useraddr })
      .value();
    if (user || usera) {
      if (user.attested) {
        return true;
      }
    } else {
      return false;
    }
  },
  isPaid: function(deviceAddr) {
    // Check before attestation that user paid the value
    var user = db
      .get("users")
      .find({ deviceAddress: deviceAddr })
      .value();
    if (user) {
      if (user.paid) {
        return true;
      }
    } else {
      return false;
    }
  },
  waitingTrx(row, device) {
    if (row.address === "3BKLY6TTEVYLCLXNXFWGRSPWZE6HEDGK") {
      return;
    }
    var user = db
      .get("users")
      .find({ addressToPaySelf: row.address })
      .value();
    if (user) {
      db.get("users")
        .find({ addressToPaySelf: row.address })
        .assign({ amountInWaiting: row.amount, paid: false })
        .write();
      device.sendMessageToDevice(
        user.deviceAddress,
        "text",
        "Your transaction is in waiting state now with this unique address: " +
          row.address +
          ", Please wait until the transaction becomes stable, you will receive the message."
      );
      return true;
    } else {
      return false;
    }
  },
  stableTrx(row, device) {
    if (row.address === "3BKLY6TTEVYLCLXNXFWGRSPWZE6HEDGK") {
      return;
    }
    var user = db
      .get("users")
      .find({ addressToPaySelf: row.address })
      .value();
    if (user) {
      var confirmedVal = user.amountConfirmed + row.amount;
      db.update("total", n => n + row.amount).write();
      db.get("users")
        .find({ addressToPaySelf: row.address })
        .assign({
          amountInWaiting: user.amountInWaiting - row.amount,
          amountConfirmed: confirmedVal,
          paid: true
        })
        .write();
      device.sendMessageToDevice(
        user.deviceAddress,
        "text",
        "Your transaction is stable now with this unique address: " +
          row.address +
          ", 𝐘𝐨𝐮 𝐜𝐚𝐧 𝐧𝐨𝐰 𝐬𝐞𝐧𝐝 𝐭𝐡𝐞 𝐚𝐝𝐝𝐫𝐞𝐬𝐬 𝐭𝐡𝐚𝐭 𝐲𝐨𝐮 𝐰𝐚𝐧𝐭 𝐭𝐨 𝐚𝐭𝐭𝐞𝐬𝐭."
      );
      return true;
    } else {
      return false;
    }
  },
  getUserData: function(deviceAddr) {
    var user = db
      .get("users")
      .find({ deviceAddress: deviceAddr })
      .value();
    if (user) {
      return user;
    } else {
      return false;
    }
  },
  saveUserWalletAddress: function(deviceAddr, userAddr) {
    db.get("users")
      .find({ deviceAddress: deviceAddr })
      .assign({ useraddress: userAddr })
      .write();
  },
  userAttested: function(deviceAddr, device, unit) {
    db.get("users")
      .find({ deviceAddress: deviceAddr })
      .assign({ attested: true, attestationUnit: unit })
      .write();
    device.sendMessageToDevice(
      deviceAddr,
      "text",
      "3BKLY6TTEVYLCLXNXFWGRSPWZE6HEDGK 𝗔𝘁𝘁𝗲𝘀𝘁𝗲𝗱 𝘁𝗵𝗶𝘀 𝘄𝗮𝗹𝗹𝗲𝘁 𝘄𝗶𝘁𝗵 𝘆𝗼𝘂𝗿 𝘁𝗲𝗹𝗲𝗴𝗿𝗮𝗺 𝗮𝗰𝗰𝗼𝘂𝗻𝘁, 𝗜𝘁'𝘀 𝗽𝘂𝗯𝗹𝗶𝗰 𝗮𝗻𝗱 𝘆𝗼𝘂 𝗰𝗮𝗻𝗻𝗼𝘁 𝘂𝗻𝗱𝗼 𝗼𝗿 𝗿𝗲𝗱𝗼 𝘁𝗵𝗶𝘀 𝗽𝗿𝗼𝗰𝗲𝘀𝘀. 𝗧𝗵𝗲 𝘂𝗻𝗶𝘁 𝗶𝗱 𝗶𝘀: " +
        unit
    );
  },
  readBalance: function() {
    if (db.get("total").value()) {
      console.error("The total amount is...");
      console.error(db.get("total").value());
      return db.get("total").value();
    } else {
      return false;
    }
  },
  setCommand: function(deviceAddr, command) { // usually used for setting tip, for others, search above
    db.get("users")
      .find({ deviceAddress: deviceAddr })
      .assign({ command: command })
      .write();
  },
  getCommand: function(deviceAddr) {
    let user = db.get('users').find({deviceAddress: deviceAddr }).value()
    if(user) {
      return user.command
    } else {
      return false
    }
  },
  sendAll: function(deviceAddr, message, device) {
    let users = db.get('users').value()
    users.forEach(function(item) {
      device.sendMessageToDevice(
      item.deviceAddress,
      "text",
      message
    );
    })
  }
}
