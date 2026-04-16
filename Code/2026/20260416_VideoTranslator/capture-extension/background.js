chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'START_CAPTURE') {
        chrome.tabCapture.getMediaStreamId({ targetTabId: request.tabId }, (streamId) => {
            chrome.tabs.sendMessage(request.tabId, { type: 'STREAM_ID_READY', streamId: streamId });
        });
    }
    return true;
});
