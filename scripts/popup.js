document.getElementById('saveKey').addEventListener('click', () => {
    const key = document.getElementById('key').value;
    chrome.storage.sync.set({ autoPopulateKey: key }, () => {
        alert('Key saved!');
    });
});
