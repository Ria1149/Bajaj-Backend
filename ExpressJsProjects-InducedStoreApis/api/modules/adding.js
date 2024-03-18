const { Api, TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

const apiId = 2392599;
const apiHash = "7e14b38d250953c8c1e94fd7b2d63550";

clients={}

exports.adding = async (req, res) => {
  var ish = null;
  console.log(req.body);
  try {
    const { stringSession, fromGroup, ToGroup, offset } = req.body;
    const client = new TelegramClient(
      new StringSession(stringSession),
      apiId,
      apiHash,
      {
        connectionRetries: 5,
      }
    );

    try {
      await client.connect({
        onError: (err) => (ish = "Account Login Failed"),
      });
      var iss = (await client.getMe()).accessHash;
      Adding({ client, fromGroup, ToGroup, offset });
      ish = "Login Sucessfull and start adding";
    } catch (err) {
      ish = "Account Login Failed";
    }
  } catch (err) {
    ish = err;
  }

  return res.status(200).send({
    mess: ish,
  });
};
exports.login = async (req, res) => {
  const { phone } = req.body;
  if ("stringsession" in req.body) {
    try {
      const client = new TelegramClient(
        new StringSession(req.body.stringsession),
        apiId,
        apiHash,
        {
          connectionRetries: 5,
        }
      );
      await client.connect();
      var iss = (await client.getMe()).firstName;
      return res.send({ mess: "Login Sucessfully", firstName: iss });
    } catch (err) {return res.send({ mess: "Login Unsucessfull" });}
  } else if ("code" in req.body) {
    try {
      await clients[phone].invoke(
        new Api.auth.SignIn({
          phoneNumber: phone,
          phoneCodeHash: req.body.phoneCodeHash,
          phoneCode: req.body.code,
        })
      );
    } catch (err) {
      if (err.errorMessage === "SESSION_PASSWORD_NEEDED") {
        return res.send({ err: "SESSION_PASSWORD_NEEDED" });
      }
    }
  } else if ("password" in req.body) {
    await clients[phone].signInWithPassword(
      {
        apiId: apiId,
        apiHash: apiHash,
      },
      {
        password: req.body.password,
        onError: (err) => {
          throw err;
        },
      }
    );
  } else {
    if ("phone" in req.body) {
      clients[phone] = new TelegramClient(
        new StringSession(""),
        apiId,
        apiHash,
        {}
      );
      await clients[phone].connect();
      const result = await clients[phone].sendCode(
        {
          apiId: apiId,
          apiHash: apiHash,
        },
        phone
      );
      const phoneCodeHash = result.phoneCodeHash;
      return res.send({ phoneCodeHash, phone });
    }
  }
  const session = await clients[phone].session.save();
  await clients[phone].disconnect();
  delete clients[phone];
  return await res.send({ session: session,phone,  });
};

async function Adding({ client, fromGroup, ToGroup, offset }) {
  try {
    await client.invoke(
      new Api.channels.JoinChannel({
        channel: ToGroup,
      })
    );

    const result = await client.invoke(
      new Api.channels.GetParticipants({
        channel: fromGroup,
        filter: new Api.ChannelParticipantsRecent({}),
        offset: offset,
        limit: 100,
        hash: 0,
      })
    );
    for await (const participant of result.users) {
      try {
        if (participant.username != null) {
          await client.invoke(
            new Api.channels.InviteToChannel({
              channel: ToGroup,
              users: [participant.username],
            })
          );
          console.log(participant.firstName + " Added");
        }
      } catch (err) {
        console.log(participant.firstName + " " + err.errorMessage);
        if (err.errorMessage == "PEER_FLOOD") {
          break;
        } else if (err.errorMessage == "FLOOD") {
          break;
        }
      }
    }
    console.log("Adding Done");
  } catch (err) {
    console.log(err.errorMessage + " " + err);
  }
}
