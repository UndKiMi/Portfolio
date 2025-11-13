const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CUSTOM_BADGES_PATH = path.join(__dirname, '../user-badges.json');
const PRESENCE_REFRESH_INTERVAL = Number(process.env.PRESENCE_REFRESH_INTERVAL) || 10000;
const TARGET_USER_ID = process.env.DISCORD_USER_ID || "558793081663782913";

let customBadges = [];
let cachedPresence = {
  user: null,
  status: 'offline',
  activities: []
};
let lastPresenceHash = null;
let targetGuild = null;
let targetMember = null;

/**
 * Charge les badges personnalisés depuis le fichier JSON
 */
function loadCustomBadges() {
  try {
    if (fs.existsSync(CUSTOM_BADGES_PATH)) {
      const badgesData = JSON.parse(fs.readFileSync(CUSTOM_BADGES_PATH, 'utf8'));
      if (badgesData.badges && Array.isArray(badgesData.badges)) {
        customBadges = [...new Set(badgesData.badges)];
        console.log('✅ Badges personnalisés chargés:', customBadges);
      }
    } else {
      customBadges = [];
    }
  } catch (err) {
    console.log('⚠️ Erreur lors du chargement des badges personnalisés:', err.message);
    customBadges = [];
  }
}

/**
 * Crée un hash de la présence pour détecter les changements
 */
function hashPresence(presence) {
  return JSON.stringify({
    status: presence.status,
    activities: presence.activities?.map(a => ({ name: a.name, details: a.details, state: a.state })),
    voiceState: presence.voiceState ? {
      channelId: presence.voiceState.channelId,
      streaming: presence.voiceState.streaming,
      video: presence.voiceState.video,
      selfMute: presence.voiceState.selfMute,
      selfDeaf: presence.voiceState.selfDeaf
    } : null
  });
}

/**
 * Met à jour le cache de présence Discord
 */
function updatePresenceCache(member, silent = false) {
  if (!member) return;

  let userFlags = member.user.flags?.toArray() || [];
  const userPublicFlags = member.user.publicFlags?.toArray() || [];

  if (customBadges.length) {
    userFlags = [...new Set([...userFlags, ...customBadges])];
  }

  if (!silent) {
    console.log('🎖️ FLAGS DÉTECTÉS:');
    console.log('   - flags:', userFlags);
    console.log('   - publicFlags:', userPublicFlags);
    console.log('   - premiumType:', member.user.premiumType);
    console.log('   - accentColor:', member.user.accentColor);
    console.log('   - banner:', member.user.banner);
  }

  const voiceChannel = member.voice?.channel;
  const isStreaming = member.voice?.streaming || false;
  const isVideo = member.voice?.selfVideo || false;
  
  if (!silent) {
    if (voiceChannel) {
      let voiceInfo = `🎤 Utilisateur en vocal: ${voiceChannel.name} dans ${voiceChannel.guild.name}`;
      if (isStreaming) voiceInfo += ' 🔴 (streaming)';
      if (isVideo) voiceInfo += ' 📹 (caméra)';
      console.log(voiceInfo);
    } else {
      console.log('🔇 Utilisateur pas en vocal');
    }
  }
  
  cachedPresence = {
    user: {
      id: member.user.id,
      username: member.user.username,
      discriminator: member.user.discriminator,
      avatar: member.user.avatar,
      displayName: member.displayName,
      flags: userFlags,
      publicFlags: userPublicFlags,
      premiumType: member.user.premiumType || 0,
      accentColor: member.user.accentColor || null,
      banner: member.user.banner || null
    },
    status: member.presence?.status || 'offline',
    activities: member.presence?.activities?.map(activity => ({
      name: activity.name,
      type: activity.type,
      details: activity.details,
      state: activity.state,
      applicationId: activity.applicationId,
      timestamps: activity.timestamps,
      assets: activity.assets ? {
        largeImage: activity.assets.largeImage,
        largeText: activity.assets.largeText,
        smallImage: activity.assets.smallImage,
        smallText: activity.assets.smallText
      } : null
    })) || [],
    voiceState: voiceChannel ? {
      channelName: voiceChannel.name,
      channelId: voiceChannel.id,
      serverName: voiceChannel.guild.name,
      guildId: voiceChannel.guild.id,
      guildIcon: voiceChannel.guild.icon,
      selfMute: member.voice.selfMute || false,
      selfDeaf: member.voice.selfDeaf || false,
      serverMute: member.voice.serverMute || false,
      serverDeaf: member.voice.serverDeaf || false,
      streaming: isStreaming,
      video: isVideo
    } : null
  };
}

/**
 * Initialise le client Discord
 */
function initializeDiscord() {
  const TOKEN = process.env.DISCORD_TOKEN;
  
  if (!TOKEN) {
    console.error('❌ ERREUR: DISCORD_TOKEN non défini dans .env');
    console.log('Créez un fichier .env avec votre token Discord');
    throw new Error('DISCORD_TOKEN manquant');
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildPresences,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates
    ]
  });

  loadCustomBadges();

  if (fs.existsSync(CUSTOM_BADGES_PATH)) {
    fs.watchFile(CUSTOM_BADGES_PATH, { persistent: false, interval: 60000 }, () => {
      console.log('🔄 Rechargement des badges personnalisés');
      loadCustomBadges();
    });
  }

  client.once('ready', async () => {
    console.log(`✅ Bot connecté: ${client.user.tag}`);
    console.log(`📊 Serveurs: ${client.guilds.cache.size}`);
    console.log(`🔍 Recherche de l'utilisateur ${TARGET_USER_ID}...\n`);

    for (const [guildId, guild] of client.guilds.cache) {
      try {
        console.log(`🔍 Recherche dans le serveur: ${guild.name} (${guildId})`);
        const member = await guild.members.fetch(TARGET_USER_ID).catch((err) => {
          console.log(`⚠️  Erreur lors de la recherche dans ${guild.name}:`, err.message);
          return null;
        });
        if (member) {
          try {
            const fullUser = await client.users.fetch(TARGET_USER_ID, { force: true });
            console.log('🔍 Utilisateur complet récupéré:', {
              flags: fullUser.flags?.toArray(),
              publicFlags: fullUser.publicFlags?.toArray(),
              premiumType: fullUser.premiumType,
              accentColor: fullUser.accentColor,
              banner: fullUser.banner
            });
            member.user = fullUser;
          } catch (err) {
            console.log('⚠️ Impossible de récupérer le profil complet:', err.message);
          }
          updatePresenceCache(member);
          console.log(`✅ Utilisateur trouvé dans: ${guild.name}`);
          console.log(`👤 Username: ${member.user.username}`);
          console.log(`📡 Statut: ${member.presence?.status || 'offline'}\n`);
          targetGuild = guild;
          targetMember = member;
          break;
        } else {
          console.log(`⚠️  Utilisateur non trouvé dans ${guild.name}`);
        }
      } catch (err) {
        console.log(`❌ Erreur lors de la recherche dans ${guild.name}:`, err.message);
      }
    }
    
    if (!targetMember) {
      console.log(`\n⚠️  ATTENTION: Utilisateur ${TARGET_USER_ID} non trouvé dans aucun serveur!`);
      console.log(`📋 Serveurs disponibles: ${Array.from(client.guilds.cache.keys()).join(', ')}`);
      console.log(`💡 Vérifiez que:`);
      console.log(`   1. L'utilisateur est membre d'au moins un serveur où le bot est présent`);
      console.log(`   2. Le bot a les permissions nécessaires (voir les membres)`);
      console.log(`   3. L'ID utilisateur est correct: ${TARGET_USER_ID}\n`);
    }

    setInterval(async () => {
      if (targetGuild && targetMember) {
        try {
          const freshMember = await targetGuild.members.fetch(TARGET_USER_ID, { force: true, cache: false });
          if (freshMember) {
            const newHash = hashPresence({
              status: freshMember.presence?.status || 'offline',
              activities: freshMember.presence?.activities,
              voiceState: freshMember.voice?.channel ? {
                channelId: freshMember.voice.channel.id,
                streaming: freshMember.voice.streaming,
                video: freshMember.voice.selfVideo,
                selfMute: freshMember.voice.selfMute,
                selfDeaf: freshMember.voice.selfDeaf
              } : null
            });
            
            if (newHash !== lastPresenceHash) {
              lastPresenceHash = newHash;
              updatePresenceCache(freshMember, true);
            }
          }
        } catch (err) {
          console.log('⚠️ Impossible de rafraîchir la présence:', err.message);
        }
      }
    }, PRESENCE_REFRESH_INTERVAL);
  });

  client.on('presenceUpdate', (oldPresence, newPresence) => {
    if (newPresence.userId === TARGET_USER_ID) {
      updatePresenceCache(newPresence.member);
      console.log(`🔄 Statut mis à jour: ${newPresence.status}`);
    }
  });

  client.on('voiceStateUpdate', (oldState, newState) => {
    if (newState.id === TARGET_USER_ID) {
      console.log('🎤 Changement d\'état vocal détecté');
      updatePresenceCache(newState.member);
    }
  });

  client.login(TOKEN).catch(err => {
    console.error('❌ Erreur de connexion Discord:', err.message);
    console.log('\n📝 Vérifiez:');
    console.log('1. Que le token est correct dans .env');
    console.log('2. Que les Privileged Gateway Intents sont activés');
    console.log('3. Que le bot est sur un serveur Discord\n');
    throw err;
  });

  return client;
}

/**
 * Retourne le cache de présence
 */
function getCachedPresence() {
  return cachedPresence;
}

module.exports = {
  initializeDiscord,
  getCachedPresence
};

