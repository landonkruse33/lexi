let typedWords = [];
let predictedWord = '';

document.addEventListener('input', (event) => {
    const currentWord = event.target.value.split(' ').pop();
    if (currentWord) {
        predictedWord = predictNextWord(currentWord);
        displayPrediction(predictedWord);
    }
});

function predictNextWord(currentWord) {
    // Placeholder for trigram prediction logic
    return 'example'; // Replace with actual prediction logic
}

function displayPrediction(word) {
    // Logic to display the predicted word
    const predictionElement = document.createElement('div');
    predictionElement.textContent = word;
    predictionElement.style.position = 'absolute';
    predictionElement.style.opacity = '0.5';
    document.body.appendChild(predictionElement);
}

document.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
        event.preventDefault();
        // Logic to insert the predicted word
    }
});

    predictedWordDiv.textContent = predictedWord;
    predictedWordDiv.style.position = 'absolute';
    predictedWordDiv.style.left = inputField.getBoundingClientRect().right + 'px';
    predictedWordDiv.style.top = inputField.getBoundingClientRect().top + 'px';
}
