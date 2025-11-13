import React, { useMemo } from 'react';
import { useDiscord } from '../hooks/useDiscord';
import './DiscordPresence.css';

const ACTIVITY_LOGOS = {
  youtube: { 
    url: 'https://upload.wikimedia.org/wikipedia/commons/e/ef/Youtube_logo.png', 
    height: '18px',
    name: 'YouTube'
  },
  twitch: { 
    url: 'https://pngimg.com/uploads/twitch/twitch_PNG12.png', 
    height: '25px',
    name: 'Twitch'
  },
  spotify: { 
    url: 'https://storage.googleapis.com/pr-newsroom-wp/1/2023/05/Spotify_Primary_Logo_RGB_Green-300x300.png', 
    height: '18px',
    name: 'Spotify'
  },
  netflix: { 
    url: 'https://cdn.rcd.gg/PreMiD/websites/N/Netflix/assets/logo.png', 
    height: '18px',
    name: 'Netflix'
  }
};

const BADGE_INFO = {
  Staff: { name: 'Personnel Discord', icon: 'https://cdn.discordapp.com/badge-icons/5e74e9b61934fc1f67c65515d1f7e60d.png' },
  Partner: { name: 'Propriétaire de serveur partenaire', icon: 'https://cdn.discordapp.com/badge-icons/3f9748e53446a137a052f3454e2de41e.png' },
  Hypesquad: { name: 'Événements HypeSquad', icon: 'https://cdn.discordapp.com/badge-icons/bf01d1073931f921909045f3a39fd264.png' },
  BugHunterLevel1: { name: 'Chasseur de bugs niveau 1', icon: 'https://cdn.discordapp.com/badge-icons/2717692c7dca7289b35297368a940dd0.png' },
  HypeSquadOnlineHouse1: { name: 'HypeSquad Bravery', icon: 'https://cdn.discordapp.com/badge-icons/8a88d63823d8a71cd5e390baa45efa02.png' },
  HypeSquadOnlineHouse2: { name: 'HypeSquad Brilliance', icon: 'https://cdn.discordapp.com/badge-icons/011940fd013da3f7fb926e4a1cd2e618.png' },
  HypeSquadOnlineHouse3: { name: 'HypeSquad Balance', icon: 'https://cdn.discordapp.com/badge-icons/3aa41de486fa12454c3761e8e223442e.png' },
  PremiumEarlySupporter: { name: 'Soutien précoce', icon: 'https://cdn.discordapp.com/badge-icons/7060786766c9c840eb3019e725d2b358.png' },
  BugHunterLevel2: { name: 'Chasseur de bugs niveau 2', icon: 'https://cdn.discordapp.com/badge-icons/848f79194d4be5ff5f81505cbd0ce1e6.png' },
  VerifiedDeveloper: { name: 'Développeur de bot vérifié', icon: 'https://cdn.discordapp.com/badge-icons/6bdc42827a38498929a4920da12695d9.png' },
  CertifiedModerator: { name: 'Ancien du programme de modération', icon: 'https://cdn.discordapp.com/badge-icons/fee1624003e2fee35cb398e125dc479b.png' },
  ActiveDeveloper: { name: 'Développeur actif', icon: 'https://cdn.discordapp.com/badge-icons/6bdc42827a38498929a4920da12695d9.png' },
  PremiumSubscriber: { name: 'Abonné Discord Nitro', icon: 'https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png' },
  Nitro: { name: 'Abonné Discord Nitro', icon: 'https://cdn.discordapp.com/badge-icons/2ba85e8026a8614b640c2837bcdfe21b.png' },
  QuestCompleted: { name: 'Quête Discord terminée', icon: 'https://cdn.discordapp.com/badge-icons/7d9ae358c8c5e118768335dbe68b4fb8.png' },
  GuildProductPurchaser: { name: 'Apprenti Orbs', icon: 'https://cdn.discordapp.com/badge-icons/83d8a1eb09a8d64e59233eec5d4d5c2d.png' },
  SupportsCommands: { name: 'Apprenti Orbs', icon: 'https://cdn.discordapp.com/badge-icons/83d8a1eb09a8d64e59233eec5d4d5c2d.png' },
  ApplicationAutoModerationRuleCreateBadge: { name: 'Apprenti Orbs', icon: 'https://cdn.discordapp.com/badge-icons/83d8a1eb09a8d64e59233eec5d4d5c2d.png' }
};

const DEFAULT_AVATAR = 'https://cdn.discordapp.com/embed/avatars/1.png';

function DiscordPresence() {
  const { data, loading } = useDiscord();

  const avatarUrl = useMemo(() => {
    if (!data?.user?.avatar) return DEFAULT_AVATAR;
    return `https://cdn.discordapp.com/avatars/${data.user.id}/${data.user.avatar}.png?size=128`;
  }, [data?.user?.avatar, data?.user?.id]);

  const username = useMemo(() => {
    if (!data?.user) return 'KiMi';
    const { username, discriminator } = data.user;
    return discriminator && discriminator !== '0' 
      ? `${username}#${discriminator}` 
      : username;
  }, [data?.user]);

  const renderLoadingState = () => (
    <div className="discord-embed" role="status" aria-live="polite">
      <div className="embed-left">
        <div className="avatar-skeleton" />
      </div>
      <div className="embed-main">
        <div className="embed-title">
          <span className="text-skeleton">Chargement...</span>
        </div>
      </div>
    </div>
  );

  const renderOfflineState = () => (
    <div className="discord-embed" role="status" aria-live="polite">
      <div className="embed-left">
        <img src={DEFAULT_AVATAR} alt="Avatar Discord" />
      </div>
      <div className="embed-main">
        <div className="embed-title">
          <span>{username}</span>
          <span className="status-dot offline" aria-label="Hors ligne"></span>
          <span>{data?.message || 'Hors ligne'}</span>
        </div>
        <div className="embed-activity text-dim">
          {data?.message || 'Vérification du statut...'}
        </div>
      </div>
    </div>
  );

  const renderVoiceActivity = (voiceState) => {
    const { channelName, guildIcon, guildId, serverName, streaming, video, selfMute, selfDeaf } = voiceState;
    
    const voiceFlags = [];
    if (video) voiceFlags.push(<span key="video" className="voice-flag" title="Caméra activée">Caméra</span>);
    if (selfMute || selfDeaf) voiceFlags.push(<span key="mute" className="voice-flag" title="Microphone désactivé">Sourdine</span>);

    return (
      <>
        <div className="embed-activity voice">
          {guildIcon && guildId ? (
            <>
              <img 
                src={`https://cdn.discordapp.com/icons/${guildId}/${guildIcon}.png?size=32`}
                className="guild-icon"
                alt={serverName || 'Serveur'}
                title={serverName}
              />
              <span>En vocal dans <strong>{channelName}</strong></span>
            </>
          ) : (
            <span>En vocal dans <strong>{channelName}</strong></span>
          )}
          {voiceFlags.length > 0 && (
            <span className="voice-flags">{voiceFlags}</span>
          )}
        </div>
        {streaming && (
          <div className="discord-streaming is-visible">
            <span className="streaming-indicator"></span>
            Partage d'écran actif
          </div>
        )}
      </>
    );
  };

  const renderRichActivity = (activities) => {
    if (!activities || activities.length === 0) {
      return <div className="embed-activity text-dim">Aucune activité</div>;
    }

    const current = activities[0];
    const activityKey = current.name?.toLowerCase();
    const logo = ACTIVITY_LOGOS[activityKey];
    
    return (
      <div className="embed-activity">
        {logo && (
          <img 
            src={logo.url} 
            className="activity-icon" 
            alt={logo.name}
            loading="lazy"
          />
        )}
        <span className="activity-name">{current.name}</span>
        {current.details && (
          <span className="activity-details"> — {current.details}</span>
        )}
        {current.state && (
          <span className="activity-state"> ({current.state})</span>
        )}
      </div>
    );
  };

  const renderBadges = () => {
    if (!data?.user) return null;

    const { user } = data;
    const badges = user.flags?.length > 0 ? user.flags : (user.publicFlags || []);
    const badgeElements = [];

    badges.forEach(flag => {
      const badgeInfo = BADGE_INFO[flag];
      if (!badgeInfo) return;

      badgeElements.push(
        <div
          key={flag}
          className="discord-badge"
          title={badgeInfo.name}
          style={{ backgroundImage: `url('${badgeInfo.icon}')` }}
          aria-label={badgeInfo.name}
        />
      );
    });

    if (user.premiumType && user.premiumType > 0) {
      const nitroInfo = BADGE_INFO['Nitro'];
      if (nitroInfo) {
        badgeElements.push(
          <div
            key="nitro"
            className="discord-badge"
            title={nitroInfo.name}
            style={{ backgroundImage: `url('${nitroInfo.icon}')` }}
            aria-label={nitroInfo.name}
          />
        );
      }
    }

    return badgeElements.length > 0 ? badgeElements : null;
  };

  if (loading && !data) {
    return renderLoadingState();
  }

  if (!data || !data.user) {
    return renderOfflineState();
  }

  const { status, activities, voiceState } = data;

  return (
    <div className="discord-embed" role="status" aria-live="polite">
      <div className="embed-left">
        <img 
          src={avatarUrl} 
          alt={`Avatar de ${username}`}
          loading="lazy"
        />
      </div>
      <div className="embed-main">
        <div className="embed-title">
          <span className="username">{username}</span>
          <span 
            className={`status-dot ${status}`}
            aria-label={data.statusLabel || 'Statut inconnu'}
          ></span>
          <span className="status-label">{data.statusLabel || 'Hors ligne'}</span>
        </div>
        {voiceState ? renderVoiceActivity(voiceState) : renderRichActivity(activities)}
        <div className="discord-badges">
          {renderBadges()}
        </div>
      </div>
    </div>
  );
}

export default DiscordPresence;

