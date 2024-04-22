document.getElementById('startButton').addEventListener('click', async () => {
    try {
        // Initialize variables for accumulating audio data
        let accumulatedBuffer = [];
        
        // 1. Get User Media
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log('Microphone access granted.');

        // 2. Create Tone.js Context and Audio Nodes
        const context = new Tone.Context();
        await Tone.start(); 

        // Apply frequency mask for desired range 
        const lowFrequencyMask = 120; // Minimum frequency to include (in Hz)
        const highFrequencyMask = 1200; // Maximum frequency to include (in Hz)

        const analyzer = new Tone.Analyser('fft', 4096); // 4096 is a common FFT size

        const source = new Tone.UserMedia().connect(analyzer);
        await source.open();

        console.log('Microphone connected and analyzer set up.');

        // Object to store significance ratings of frequencies over time
        const significanceRecord = {};

        // Define the processAudio function
        function processAudio() {
            const buffer = analyzer.getValue(); // Get time-domain data
            accumulatedBuffer.push(...buffer); // Accumulate audio data
            
            // Check if accumulated buffer duration exceeds the window size
            const windowSize = Math.round(44100 * 2 / 4096); // 3 seconds (assuming buffer.length = 4096)
            if (accumulatedBuffer.length >= windowSize) {
                // Extract a window of data from the accumulated buffer
                const windowedBuffer = accumulatedBuffer.slice(0, windowSize);
                
                // Apply windowing to the windowed buffer
                const windowedData = applyWindow(windowedBuffer, hann); // Apply Hann window
                
                // Perform spectral analysis on the windowed buffer
                const spectrum = analyzer.getValue(); // Get frequency-domain data
                const { dominantFrequencies, significanceList } = getDominantFrequencies(spectrum, analyzer); // Get dominant frequencies
                
                maxNote(significanceList);

                console.log("Dominant Frequencies (Hz):", dominantFrequencies); // Print dominant frequencies
                console.log("Significance List:", significanceList); // Print significance list


                // Remove the processed data from the accumulated buffer
                accumulatedBuffer = accumulatedBuffer.slice(windowSize);
            }
        }

        // Start Analysis Loop
        setInterval(processAudio, 3000); // Analyze every 3 seconds
        console.log('FFT analysis started.');

    } catch (error) {
        console.error("Error setting up audio:", error);
    }
});

// Helper function to apply a windowing function to the input signal
function applyWindow(buffer, windowFunction) {
    return buffer.map((value, index) => value * windowFunction(index, buffer.length));
}



// Object to store significance ratings of frequencies over time
const significanceRecord = {};


function getDominantFrequencies(spectrum, analyzer, n = 6) {
    const frequencyData = [];

    // Convert spectrum to array of { frequency, amplitude } objects
    for (let i = 0; i < spectrum.length / 2; i++) {
        // Calculate frequency using the corrected formula
        const frequency = i * (analyzer.context.sampleRate / analyzer.size / 2);
        // Check if frequency is within the desired range (80 Hz to 600 Hz)
        if (frequency >= 80 && frequency <= 600 && isFinite(spectrum[i])) {
            frequencyData.push({ 
                frequency: frequency,
                amplitude: spectrum[i]
            });
        }
    }

    // Sort by amplitude (descending)
    frequencyData.sort((a, b) => b.amplitude - a.amplitude);

    // Initialize the output arrays for dominant frequencies and significance list
    const dominantFrequencies = [];
    const significanceList = [];

    // Iterate over frequencyData to select dominant frequencies 
    for (let i = 0; i < frequencyData.length && dominantFrequencies.length < n; i++) {
        const currentFrequency = frequencyData[i].frequency;


            // Check if the current frequency is too close to the key frequency
    if (Math.abs(currentFrequency - (1.25*key_note)) <= 8) {
        continue; // Skip this frequency
    }
    if (Math.abs(currentFrequency - (1.5*key_note)) <= 8) {
        continue; // Skip this frequency
    }

        // Check if the current frequency is unique and not too close to previously selected frequencies
        let isUnique = true;
        for (let j = 0; j < dominantFrequencies.length; j++) {
            const frequencyDifference = Math.abs(currentFrequency - dominantFrequencies[j].frequency);
            if ((frequencyDifference / dominantFrequencies[j].frequency) * 100 <= 5) {
                isUnique = false;
                break;
            }
        }

        // Add the frequency to the dominant frequencies array if it's unique
        if (isUnique) {
            dominantFrequencies.push({ frequency: currentFrequency }); 
        }

        // Check if the frequency is not already present in the significance record
        if (!significanceRecord[currentFrequency]) {
            // Frequency is encountered for the first time, initialize its significance to 1
            significanceRecord[currentFrequency] = 1;
        }
    }

// Weighting factors for different positions
const weightingFactors = [.6, .5, .4, .3, .2, .1];

// Update significance ratings for frequencies in dominantFrequencies
for (let i = 0; i < dominantFrequencies.length; i++) {
    const frequency = dominantFrequencies[i].frequency;

        // Check if the most dominant frequency has significance over 4
        if (i === 0 && significanceRecord[frequency] > 3.9) {
            significanceRecord[frequency] -= 0.1;
        }

    if (significanceRecord[frequency]) {
        // Frequency is present in dominantFrequencies, increase its significance by the weighted factor
        significanceRecord[frequency] += weightingFactors[i];
    }
}




    // Decrease significance ratings for frequencies not in dominantFrequencies
    for (const frequency in significanceRecord) {
        if (!dominantFrequencies.some(freqObj => freqObj.frequency === parseFloat(frequency))) {
            // Frequency is not present in dominantFrequencies, decrease its significance by 1
            significanceRecord[frequency] = Math.max(1, significanceRecord[frequency] - 1);
        }
    }

    // Populate significanceList with frequencies and their significance ratings
    for (const frequencyObj of frequencyData) {
        const { frequency, amplitude } = frequencyObj;
        const significance = significanceRecord[frequency] || 1; // Default significance to 1 if not found
        significanceList.push({ frequency, significance });
    }

   // Sort significance list by significance
    significanceList.sort((a, b) => b.significance - a.significance);

           // Print top 5 highest significance frequencies and their ratings
           console.log("Top 5 Highest Significance Frequencies:");
           for (let i = 0; i < Math.min(5, significanceList.length); i++) {
               console.log(`${significanceList[i].frequency} Hz: ${significanceList[i].significance}`);
           }

    // Return both dominant frequencies and significance list
    return { dominantFrequencies, significanceList };

 

}

window.key_note = 0;
significancethresh = 3.6;

//get highest significance note over 20
function maxNote(significanceList) {
    let key_note = 0; // Default value if no frequency is found
    significanceList.sort((a, b) => b.significance - a.significance);
    // Check if the highest  rating is over 4
    if (significanceList.length > 0 && significanceList[0].significance > significancethresh) {
        // Assign the frequency with the highest significance rating to note-x
        key_note = significanceList[0].frequency;
        window.key_note = key_note;
        // Update the significance of the identified key_note by subtracting .4
        significanceList[0].significance -= 0.4;
        console.log("Key Note:", key_note);
        addMessageDiv('Tone Identified. Creating Chord');
    } else {
        console.log("No significant notes with rating over 4.");
        addMessageDiv('Listening...'); 
        key_note = 0;
        window.key_note = key_note;

    }
}


// Helper function for Hann window
function hann(i, N) {
    return 0.5 * (1 - Math.cos(6.283185307179586 * i / (N - 1)));
}



function addMessageDiv(message) {
  const container = document.getElementById('message-container'); 

  // Remove any existing message divs
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  // Create the new message div
  const messageDiv = document.createElement('div');
  messageDiv.textContent = message;
  messageDiv.classList.add('message'); 
  container.appendChild(messageDiv); 
}
