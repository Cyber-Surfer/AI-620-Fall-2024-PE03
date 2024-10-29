"use strict";
// Attempt #2.6.2
const serverUrl = "https://e75u8waiqj.execute-api.us-west-2.amazonaws.com/api";


class HttpError extends Error {
    constructor(response) {
        super(`${response.status} for ${response.url}`);
        this.name = "HttpError";
        this.response = response;
    }
}

let audioRecorder;
let recordedAudio;
let isRecording = false;

const mediaConstraints = {
    audio: true
};

navigator.mediaDevices.getUserMedia(mediaConstraints)
    .then(onMediaSuccess)
    .catch(onMediaError);

const maxAudioLength = 30000;
let audioFile = {};

function onMediaSuccess(audioStream) {
    console.log('Media Success');
    audioRecorder = new MediaRecorder(audioStream);
    audioRecorder.ondataavailable = handleAudioData;

    // Set up button event listeners here after initialization
    document.getElementById("record-toggle").addEventListener("click", toggleRecording);
    document.getElementById("translate").addEventListener("click", uploadAndTranslate);
}

function onMediaError(error) {
    console.error('Media Error:', error);
    alert("Media Error - Audio recording not available: " + error.message);
}


function startRecording() {
    recordedAudio = [];
    audioRecorder.start(maxAudioLength);
}

function stopRecording() {
    audioRecorder.stop(); // Stop recording
}

function handleAudioData(event) {
    console.log('Audio data size:', event.data.size); // Log size to debug
    if (event.data.size > 0) {
        audioFile = new File([event.data], "recorded_audio.wav", { type: "audio/wav" });
        console.log('Audio file created:', audioFile); // Log the audioFile
        const audioElem = document.getElementById("recording-player");
        audioElem.src = URL.createObjectURL(audioFile);
    } else {
        console.error('No audio data received.');
    }
}

function toggleRecording() {
    let toggleBtn = document.getElementById("record-toggle");
    let translateBtn = document.getElementById("translate");

    if (isRecording) {
        toggleBtn.value = 'Record';
        translateBtn.disabled = false;
        stopRecording();
    } else {
        if (!audioRecorder) {
            console.error("Audio recorder not initialized.");
            return;
        }
        toggleBtn.value = 'Stop';
        translateBtn.disabled = true;
        startRecording();
    }

    isRecording = !isRecording;
}

async function uploadRecording() {
    if (!audioFile || !(audioFile instanceof Blob)) {
        alert('No audio file to upload or invalid file type.');
        throw new Error('Audio file is not available or is not a Blob.');
    }
    
    // Proceed with reading the audio file...
    const converter = new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(audioFile);
        reader.onload = () => resolve(reader.result.toString().replace(/^data:(.*,)?/, ''));
        reader.onerror = (error) => reject(error);
    });
    
    let encodedString = await converter;

    // make server call to upload image
    // and return the server upload promise
    return fetch(serverUrl + "/recordings", {
        method: "POST",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({filename: audioFile.name, filebytes: encodedString})
    }).then(response => {
        if (response.ok) {
            return response.json();
        } else {
            throw new HttpError(response);
        }
    })
}

let fromLang;
let toLang;

function translateRecording(audio) {
    if (!audio || !audio.fileId) {
        console.error('Invalid audio object:', audio);
        throw new Error('Invalid audio data for translation');
    }

    let fromLangElem = document.getElementById("fromLang");

    fromLang = fromLangElem[fromLangElem.selectedIndex].value;

    let toLangElem = document.getElementById("toLang");

    toLang = toLangElem[toLangElem.selectedIndex].value;

    // start translation text spinner
    let textSpinner = document.getElementById("text-spinner");
    textSpinner.hidden = false;

    // make server call to transcribe recorded audio
    return fetch(serverUrl + "/recordings/" + audio["fileId"] + "/translate-text", {
        method: "POST",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({fromLang: fromLang, toLang: toLang})
    }).then(response => {
        if (response.ok) {
            return response.json();
        } else {
            throw new HttpError(response);
        }
    })
}

function updateTranslation(translation) {
    // stop translation text spinner
    let textSpinner = document.getElementById("text-spinner");
    textSpinner.hidden = true;

    let transcriptionElem = document.getElementById("transcription");
    transcriptionElem.appendChild(document.createTextNode(translation["text"]));

    let translationElem = document.getElementById("translation");
    translationElem.appendChild(document.createTextNode(translation["translation"]["translatedText"]));

    return translation
}

function synthesizeTranslation(translation) {
    // start translation audio spinner
    let audioSpinner = document.getElementById("audio-spinner");
    audioSpinner.hidden = false;

    // make server call to synthesize translation audio
    return fetch(serverUrl + "/synthesize_speech", {
        method: "POST",
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({text: translation["translation"]["translatedText"], language: toLang})
    }).then(response => {
        if (response.ok) {
            return response.json();
        } else {
            throw new HttpError(response);
        }
    })
}

function updateTranslationAudio(audio) {
    // stop translation audio spinner
    let audioSpinner = document.getElementById("audio-spinner");
    audioSpinner.hidden = true;

    let audioElem = document.getElementById("translation-player");
    audioElem.src = audio["audioUrl"];
}

function uploadAndTranslate() {
    let toggleBtn = document.getElementById("record-toggle");
    toggleBtn.disabled = true;
    let translateBtn = document.getElementById("translate");
    translateBtn.disabled = true;

    uploadRecording()
        .then(audio => translateRecording(audio))
        .then(translation => updateTranslation(translation))
        .then(translation => synthesizeTranslation(translation))
        .then(audio => updateTranslationAudio(audio))
        .catch(error => {
            alert("Error: " + error);
        })

    toggleBtn.disabled = false;
}

// Debugging
