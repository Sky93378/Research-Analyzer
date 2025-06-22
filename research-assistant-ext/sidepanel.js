document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('summarizeBtn').addEventListener('click', summarizeText);
    document.getElementById('translateBtn').addEventListener('click', translateText);
    document.getElementById('saveNotesBtn').addEventListener('click', saveNotes);
    document.getElementById('viewNotesBtn').addEventListener('click', () => {
    chrome.downloads.showDefaultFolder(); // 🔓 Opens Downloads folder directly


});

});

// 🔄 Spinner Controls
function showSpinner() {
    document.getElementById('loadingSpinner').classList.remove('hidden');
}

function hideSpinner() {
    document.getElementById('loadingSpinner').classList.add('hidden');
}

// ✅ Show result (formatted)
function showResult(content) {
    document.getElementById('results').innerHTML = `
        <div class="result-item"><div class="result-content">${content}</div></div>`;
}

// ✏️ Get selected text from the current tab
async function getSelectedText() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: () => window.getSelection().toString()
    });
    return result?.trim() || '';
}

// 🚀 Summarize Selected Text
async function summarizeText() {
    try {
        showSpinner();

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const [{ result }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => window.getSelection().toString()
        });

        if (!result) {
            hideSpinner();
            showResult('Please select some text first');
            return;
        }

        const response = await fetch('http://localhost:8081/api/research/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: result, operation: 'summarize' })
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }

        const summary = await response.text();
        showResult(summary.replace(/\n/g, '<br>'));
        showToast("Text summarized successfully!"); // ✅ Toast feedback

    } catch (error) {
        showResult('Error: ' + error.message);
    } finally {
        hideSpinner();
    }
}


// 🌍 Translate Selected Text
async function translateText() {
    try {
        showSpinner();

        const language = document.getElementById('languageSelect').value;

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const [{ result: selectedText }] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => window.getSelection().toString()
        });

        if (!selectedText || selectedText.trim() === "") {
            hideSpinner();
            showResult("Please select some text to translate.");
            return;
        }

        const response = await fetch('http://localhost:8081/api/research/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: selectedText,
                targetLanguage: language
            })
        });

        if (!response.ok) {
            throw new Error(`Translation API Error: ${response.status}`);
        }

        const translatedText = await response.text();

        // ✅ Show in results section (like summary), not in notes
        showResult(`<strong>Translated Text:</strong><br>${translatedText.replace(/\n/g, '<br>')}`);
        showToast("Translated successfully!");

    } catch (error) {
        showResult('Error: ' + error.message);
    } finally {
        hideSpinner();
    }
}


// 💾 Save notes to download
function saveNotes() {
    const notes = document.getElementById('notes').value.trim();
    if (!notes) {
        alert("Please write some notes before saving.");
        return;
    }

    const blob = new Blob([notes], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `Research_Notes_${timestamp}.txt`;

    chrome.downloads.download({
        url: url,
        filename: filename,
        saveAs: true
    }, function (downloadId) {
        if (chrome.runtime.lastError) {
            alert('Download failed: ' + chrome.runtime.lastError.message);
        } else {
            alert('Notes saved successfully!');
            document.getElementById('notes').value = '';
            lastDownloadId = downloadId;
        }
        URL.revokeObjectURL(url);
    });
}

// 📂 View last downloaded note
let lastDownloadId = null;

function viewSavedNote() {
    if (lastDownloadId !== null) {
        chrome.downloads.search({ id: lastDownloadId }, function (results) {
            if (results?.length > 0) {
                chrome.downloads.show(results[0].id);
            } else {
                alert("No downloaded file found.");
            }
        });
    } else {
        alert("Please save a note first.");
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.innerText = message;
    toast.className = 'toast-message';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}


let mediaRecorder;
let recordedChunks = [];

document.getElementById('startRecordingBtn').addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    recordedChunks = []; // reset
    mediaRecorder = new MediaRecorder(stream);
    
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      document.getElementById('audioPreview').src = URL.createObjectURL(new Blob(recordedChunks));
      document.getElementById('audioPreview').classList.remove('hidden');
    };

    mediaRecorder.start();
    showToast("🎙️ Recording started...");
    
    // Toggle buttons
    document.getElementById('startRecordingBtn').classList.add('hidden');
    document.getElementById('stopRecordingBtn').classList.remove('hidden');

  } catch (err) {
    console.error("Microphone access denied or failed.", err);
    showToast("❌ Microphone permission denied.");
  }
});

document.getElementById('stopRecordingBtn').addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
    showToast("🔴 Recording stopped.");

    // Toggle buttons
    document.getElementById('stopRecordingBtn').classList.add('hidden');
    document.getElementById('startRecordingBtn').classList.remove('hidden');
  } else {
    showToast("⚠️ No active recording.");
  }
});

document.getElementById('saveRecordingBtn').addEventListener('click', () => {
  if (recordedChunks.length === 0) {
    showToast("⚠️ No recording to save.");
    return;
  }

  const blob = new Blob(recordedChunks, { type: 'audio/webm' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'voice-note.webm';
  a.click();
  URL.revokeObjectURL(url);

  showToast("✅ Voice note saved!");
});
