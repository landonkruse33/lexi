# Pop-up for Trigram Model Word Prediction Extension

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Word Prediction Settings</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            padding: 20px;
            background-color: #f4f4f4;
            border-radius: 8px;
        }
        h1 {
            color: #333;
        }
        label {
            display: block;
            margin: 10px 0 5px;
        }
        input[type="text"] {
            width: 100%;
            padding: 8px;
            margin-bottom: 10px;
        }
        button {
            padding: 10px 15px;
            background-color: #007BFF;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
        }
        button:hover {
            background-color: #0056b3;
        }
    </style>
</head>
<body>
    <h1>Customize Your Word Prediction Key</h1>
    <label for="customKey">Enter your preferred key:</label>
    <input type="text" id="customKey" placeholder="e.g., Enter, Space, etc.">
    <button id="saveKey">Save Key</button>
    <p id="confirmationMessage" style="color: green; display: none;">Key saved successfully!</p>

    <script>
        document.getElementById('saveKey').addEventListener('click', function() {
            const key = document.getElementById('customKey').value;
            // Save the key to local storage or settings
            localStorage.setItem('predictedWordKey', key);
            document.getElementById('confirmationMessage').style.display = 'block';
        });
    </script>
</body>
</html>
