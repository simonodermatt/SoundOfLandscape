window.midiInput = null;
window.midiOutput = null;
window.midiAccess = null;

// Initialize MIDI Access
window.initMIDI = function() {
    let btn = document.getElementById('btn-init-midi');
    if (btn) btn.innerText = "[ STARTING... ]";

    if (navigator.requestMIDIAccess) {
        navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
    } else {
        alert("Web MIDI API wird von deinem Browser nicht unterstützt.");
        if (btn) btn.innerText = "[ MIDI K.O. II ]";
    }
};

function onMIDISuccess(midiAccess) {
    window.midiAccess = midiAccess;
    let btn = document.getElementById('btn-init-midi');
    if (btn) {
        btn.innerText = "[ MIDI ACTIVE ]";
        btn.style.background = "#00BFFF";
        btn.style.color = "#1a1a1a";
    }

    populateMIDIDropdowns();

    // Listen for connection changes
    midiAccess.onstatechange = function(e) {
        populateMIDIDropdowns();
    };
}

function onMIDIFailure(msg) {
    console.error("Failed to get MIDI access - " + msg);
    alert("Fehler beim Zugriff auf MIDI-Geräte: " + msg);
    let btn = document.getElementById('btn-init-midi');
    if (btn) btn.innerText = "[ MIDI K.O. II ]";
}

function populateMIDIDropdowns() {
    let selectIn = document.getElementById('sel_midi_in');
    let selectOut = document.getElementById('sel_midi_out');

    if (!selectIn || !selectOut) return;

    // Save current selection if any
    let currentIn = selectIn.value;
    let currentOut = selectOut.value;

    selectIn.innerHTML = '<option value="">-- NO MIDI IN --</option>';
    selectOut.innerHTML = '<option value="">-- NO MIDI OUT --</option>';

    if (window.midiAccess) {
        for (let input of window.midiAccess.inputs.values()) {
            let opt = document.createElement('option');
            opt.value = input.id;
            opt.text = input.name || input.id;
            selectIn.add(opt);
        }
        for (let output of window.midiAccess.outputs.values()) {
            let opt = document.createElement('option');
            opt.value = output.id;
            opt.text = output.name || output.id;
            selectOut.add(opt);
        }
    }

    // Restore selection if still exists
    if (currentIn) {
        for (let i = 0; i < selectIn.options.length; i++) {
            if (selectIn.options[i].value === currentIn) selectIn.selectedIndex = i;
        }
    }
    if (currentOut) {
        for (let i = 0; i < selectOut.options.length; i++) {
            if (selectOut.options[i].value === currentOut) selectOut.selectedIndex = i;
        }
    }

    // Rebind input listener on change or initial population
    window.selectMidiInput();
    window.selectMidiOutput();
}

window.selectMidiInput = function() {
    let selectIn = document.getElementById('sel_midi_in');
    if (!selectIn || !window.midiAccess) return;

    // Clear old listener
    if (window.midiInput) {
        window.midiInput.onmidimessage = null;
    }

    let inputId = selectIn.value;
    if (inputId) {
        window.midiInput = window.midiAccess.inputs.get(inputId);
        if (window.midiInput) {
            window.midiInput.onmidimessage = onMIDIMessage;
        }
    } else {
        window.midiInput = null;
    }
};

window.selectMidiOutput = function() {
    let selectOut = document.getElementById('sel_midi_out');
    if (!selectOut || !window.midiAccess) return;

    let outputId = selectOut.value;
    if (outputId) {
        window.midiOutput = window.midiAccess.outputs.get(outputId);
    } else {
        window.midiOutput = null;
    }
};

// Handle Incoming MIDI Messages
function onMIDIMessage(event) {
    let data = event.data;
    if (data.length === 0) return;

    let status = data[0] >> 4;
    let channel = data[0] & 0xf;
    let type = data[0];

    // Real-Time Messages (System Realtime do not have a channel)
    // 0xFA = Start, 0xFC = Stop, 0xFB = Continue
    if (type === 0xFA || type === 0xFB) {
        // Start or Continue
        if (!window.vinylIsPlaying && typeof window.playVinyl === 'function') {
            window.playVinyl();
        }
        return;
    } else if (type === 0xFC) {
        // Stop
        if (window.vinylIsPlaying && typeof window.playVinyl === 'function') {
            window.playVinyl();
        }
        return;
    }

    // CC Messages (Status 0xB)
    if (status === 11) {
        let ccNumber = data[1];
        let ccValue = data[2]; // 0-127

        // Map any CC input to the Mutation slider as requested
        let mutationSlider = document.getElementById('range_vinyl_mutation');
        if (mutationSlider) {
            // Map 0-127 to 0.5-1.5
            let min = 0.5;
            let max = 1.5;
            let mappedVal = min + (ccValue / 127) * (max - min);

            mutationSlider.value = mappedVal.toFixed(1);

            // Trigger the oninput event logic manually
            let ttVal = document.getElementById('tt_val_vinyl_mutation');
            if (ttVal) {
                ttVal.innerText = mappedVal.toFixed(1);
            }
            if (window.vinylAiSequence) {
                window.vinylAiSequence = null;
                let btn = document.getElementById('btn-ai-compose');
                if (btn) {
                    btn.style.background = '';
                    btn.style.color = '';
                }
            }
        }
    }
}

// Helper to send a MIDI Note
window.sendMidiNote = function(pitch, velocity, durationMs, delayMs, channelNum) {
    if (!window.midiOutput) return;

    // ChannelNum is 1-16. Convert to 0-15.
    let ch = Math.max(0, Math.min(15, channelNum - 1));

    // MIDI Note On (0x90) + channel
    let noteOn = 0x90 | ch;
    // MIDI Note Off (0x80) + channel
    let noteOff = 0x80 | ch;

    // Pitch & Velocity bounds
    pitch = Math.max(0, Math.min(127, Math.round(pitch)));
    velocity = Math.max(0, Math.min(127, Math.round(velocity)));

    let msgOn = [noteOn, pitch, velocity];
    let msgOff = [noteOff, pitch, 0];

    // Web MIDI API uses DOMHighResTimeStamp for scheduling
    // performance.now() is current time in ms
    let timeOn = performance.now() + delayMs;
    let timeOff = timeOn + durationMs;

    window.midiOutput.send(msgOn, timeOn);
    window.midiOutput.send(msgOff, timeOff);
};

// Convert frequency to MIDI Note
window.freqToMidiPitch = function(freq) {
    if (freq <= 0) return 0;
    // MIDI note 69 is A4 (440 Hz)
    return Math.round(12 * Math.log2(freq / 440) + 69);
};
