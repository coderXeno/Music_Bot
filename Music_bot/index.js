const { Client, Intents } = require('discord.js')
const { prefix, token } = require('./config.json');
const ytdl = require('ytdl-core');
const { executionAsyncResource } = require('async_hooks');
const { CLIENT_RENEG_WINDOW } = require('tls');
const { resourceLimits } = require('worker_threads');

const client = new Client({
  intents: [Intents.FLAGS.GUILDS]
});

const queue = new Map();

client.once('ready', () => {
  console.log(`Ready!Logged in as ${client.user.username}`);
});

client.once('reconnecting', () => {
  console.log(`Reconnecting!! ${client.user.username} is trying to reconnect!`);
});

client.once('disconnect', () => {
  console.log(`${client.user.username} was disconnected!!`);
});

client.on("message", async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith(prefix)) return;

  const serverQueue = queue.get(message.guild.id);

  if (message.content.startsWith(`${prefix}play`)) {
    execute(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}skip`)){
    skip(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}stop`)){
    stop(message, serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}rewind`)){
    rewind(message,serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}pause`)){
    pause(message,serverQueue);
    return;
  } else if (message.content.startsWith(`${prefix}resume`)){
    resume(message.serverQueue);
    return;
  } else {
    message.channel.send('You need to enter a valid command!')
  }
});

async function execute(message, serverQueue) {

  const args = message.content.split(" ");
  const voiceChannel = message.member.voiceChannel;

  if (!voiceChannel)
    return message.channel.send(
      "You need to be in a voice channel to play music!"
    );
  const permissions = voiceChannel.permissionsFor(message.client.user);
  if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
    return message.channel.send(
      "I need the permissions to join and speak in your voice channel!"
    );
  }

  const songInfo = await ytdl.getInfo(args[1]);
  const song = {
    title: songInfo.videoDetails.title,
    url: songInfo.videoDetails.video_url,
  };

  if(!serverQueue){

    const queueContract={
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      connection: null,
      songs: [],
      volume: 5,
      playing: true
    };

    queue.set(message.guild.id,queueContract);
    queueContract.songs.push(song);

    try{
      var connnection=await voiceChannel.join();
      queueContract.connection=connnection;

      play(message.guild,queueContract.songs[0]);
    } catch(err){
      console.log(error);

      queue.delete(message.guild.id);
      return message.channel.send(err);
    }
  } else {
    serverQueue.songs.push(song);

    return message.channel.send(`${song.title} has been added to the queue!`)
  }
}


function skip(message,serverQueue){
  if(!message.member.voice.channel)
    return message.channel.send("You have to be in a voice channel to skip the music!");

  if(!serverQueue)
    return message.channel.send("There is no song that I could skip!!");

  serverQueue.connection.dispatcher.end();
}

function stop(message,serverQueue){
  if(!message.member.voice.channel)
    return message.channel.send("You have to be in a voice channelto stop the music!");
  
    if(!serverQueue)
    return message.channel.send("There is no song that I could skip!!");

  serverQueue.songs=[]
  serverQueue.connection.dispatcher.end();
}

function rewind(message,serverQueue){
  if(!message.member.voiceChannel)
    return message.channel.send("You have to be in a voice channel to rewind the song!");

  if(!serverQueue)
    return message.channel.send("There is no song to rewind!!Play one first!!");

  serverQueue.connection.dispatcher.rewind();
}

function pause(message,serverQueue){
  if(!message.member.voiceChannel)
    return message.channel.send("You have to be in a voice channel to pause the song!");

  if(!serverQueue)
    return message.channel.send("There is no song to pause!!Play one first!!");

  serverQueue.connection.dispatcher.pause();
}

function resume(message,serverQueue){
  if(!message.member.voiceChannel)
    return message.channel.send("You have to be in a voice channel to resume the song!");

  if(!serverQueue)
    return message.channel.send("There is no song paused currently!!")

  serverQueue.connection.dispatcher.resume();
}

function play(guild,song){

  const serverQueue=queue.get(guild.id);

  if(!song){
    serverQueue.voiceChannel.leave();
    queue.delete(guild.id);
    return;
  }

  const dispatcher=serverQueue.connection
      .play(ytdl(song.url))
      .on("finish",()=>{
        serverQueue.songs.shift();
        play(guild, serverQueue.songs[0]);
      })
      .on("error",error=> console.error(error));
  dispatcher.setVolumeLogarithmic(serverQueue.volume/5);
  serverQueue.textChannel.send(`Start playing: **${song.title}`);
}

client.login(token);