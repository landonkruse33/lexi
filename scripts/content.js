let typedWords = [];
let autoPopulateKey = 'Tab';

chrome.storage.sync.get('autoPopulateKey', (data) => {
    if (data.autoPopulateKey) {
        autoPopulateKey = data.autoPopulateKey;
    }
});

document.addEventListener('input', (event) => {
    const inputField = event.target;
    if (inputField.tagName === 'TEXTAREA' || inputField.tagName === 'INPUT') {
        const words = inputField.value.split(' ');
        const lastWord = words[words.length - 1];
        typedWords.push(lastWord);
        const predictedWord = predictNextWord(lastWord);
        displayPredictedWord(inputField, predictedWord);
    }
});

document.addEventListener('keydown', (event) => {
    if (event.key === autoPopulateKey) {
        const inputField = document.activeElement;
        if (inputField.tagName === 'TEXTAREA' || inputField.tagName === 'INPUT') {
            const words = inputField.value.split(' ');
            const lastWord = words[words.length - 1];
            const predictedWord = predictNextWord(lastWord);
            inputField.value += ' ' + predictedWord;
            event.preventDefault();
        }
    }
});

function predictNextWord(lastWord) {
    // Simple trigram prediction logic (placeholder)
    return lastWord + 'ly'; // Example prediction
}

function displayPredictedWord(inputField, predictedWord) {
    const predictedWordDiv = document.getElementById('predictedWord');
    predictedWordDiv.textContent = predictedWord;
    predictedWordDiv.style.position = 'absolute';
    predictedWordDiv.style.left = inputField.getBoundingClientRect().right + 'px';
    predictedWordDiv.style.top = inputField.getBoundingClientRect().top + 'px';
}
