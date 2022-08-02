const notify = (tab, e, badge = 'E') => chrome.storage.local.get({
  color: '#d93025'
}, prefs => {
  chrome.action.setBadgeText({
    tabId: tab.id,
    text: badge
  });
  chrome.action.setBadgeBackgroundColor({
    tabId: tab.id,
    color: prefs.color
  });
  chrome.action.setTitle({
    tabId: tab.id,
    title: e.message || e
  });

  clearTimeout(notify.id);
  notify.id = setTimeout(() => chrome.action.setBadgeText({
    tabId: tab.id,
    text: ''
  }), 3000);
});

chrome.action.onClicked.addListener(async tab => {
  try {
    if (!tab.url) {
      throw Error('run on a YouTube page');
    }
    if (tab.url.includes('youtube.com') === false) {
      throw Error('run on a YouTube page');
    }

    const r = await chrome.scripting.executeScript({
      target: {
        tabId: tab.id,
        allFrames: true
      },
      func: () => {
        try {
          const p = [...document.querySelectorAll('.html5-video-player')].sort((a, b) => {
            return b.offsetHeight - a.offsetHeight;
          }).shift();

          if (p) {
            return {
              channelId: p.getPlayerResponse().videoDetails.channelId
            };
          }
          throw Error('no player is detected');
        }
        catch (e) {
          return {
            message: e.message
          };
        }
      },
      world: 'MAIN'
    });
    r.sort((a, b) => {
      return a.frameId - b.frameId;
    });
    const channelIds = r.filter(r => r.result.channelId).map(r => r.result.channelId);

    if (channelIds.length === 0) {
      const message = r.filter(r => r.result.message).map(r => r.result.message).shift();

      throw Error(message || 'Cannot find the channelId');
    }

    chrome.tabs.create({
      url: 'https://www.youtube.com/feeds/videos.xml?channel_id=' + channelIds[0],
      index: tab.index + 1
    });
  }
  catch (e) {
    notify(tab, e);
  }
});

{
  const image = async url => {
    const blob = await fetch(url).then(r => r.blob());
    const img = await createImageBitmap(blob);
    const {width: w, height: h} = img;
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, w, h);

    return ctx.getImageData(0, 0, w, h);
  };
  const once = () => chrome.declarativeContent.onPageChanged.removeRules(undefined, async () => {
    const action = new chrome.declarativeContent.SetIcon({
      imageData: {
        16: await image('/data/icons/16.png'),
        32: await image('/data/icons/32.png')
      }
    });
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [new chrome.declarativeContent.PageStateMatcher({
        pageUrl: {
          hostSuffix: 'youtube.com'
        }
      })],
      actions: [action]
    }]);
  });
  chrome.runtime.onStartup.addListener(once);
  chrome.runtime.onInstalled.addListener(once);
}
