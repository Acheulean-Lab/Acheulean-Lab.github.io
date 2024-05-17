const fftrate = 2;
const samplerate = 44100;
const fftsize = 8192;
const lowFrequencyMask = 110; // Minimum frequency to include (in Hz) a2
const highFrequencyMask = 1760; // Maximum frequency to include (in Hz) a5
const notes = ["A", "A#", "B", "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#"];
const intervals = [7, 5, 9, 4, 3, 8 ]; //pleasant list
const illegalIntervals = [1, 2, 6, 10, 11]; //unpleasant list
let dominantFrequencies = [];
let matchingPairs = [];
let topNotes = [];
let allTop = [];
let filteredTopNotes = [];
let noteCountArray = [];
let key_note = 0;
let previousKeyNote = null;
window.key_note = 0;
let centernote = 0;
const dbthreshold = -101; // Final fft volume cutoff  
let Soundout; 

//running at 3/4 volume level
//add weight for dominant freq over time - 
    // need to smooth choppy sound like speech 

//click start, connect mic,  Analysis Loop
document.getElementById("startButton").addEventListener("click", async () => {
  try {
    let accumulatedBuffer = [];
    let soundoutAccumulatedBuffer = [];
 
    //  Create Tone.js Context and Audio Nodes
    const context = new Tone.Context();
    await Tone.start();
    // Creat output signal
     Soundout = new Tone.Gain().toDestination();
    updateKeyNote();
    
    const Soundoutan = new Tone.Analyser('fft', fftsize);
    Soundout.connect(Soundoutan);


    const source = new Tone.UserMedia()
    await source.open();
    console.log("Microphone connected and analyzer set up.");
    //made mono
    const monosource = new Tone.Mono();
    source.connect(monosource);
    const analyzer = new Tone.Analyser("fft", fftsize); // 4096 sampel FFT size
    monosource.connect(analyzer);
 
    
    function processAudio() {
      const micbuffer = analyzer.getValue(); 
      accumulatedBuffer.push(...micbuffer); // Accumulate mic data
      const soundoutBuffer = Soundoutan.getValue();
      soundoutAccumulatedBuffer.push(...soundoutBuffer); // Accumulate synth data

      // Check if accumulated buffer duration exceeds the window size
      const windowSize = Math.round((samplerate * fftrate) / fftsize); 

      if (accumulatedBuffer.length >= windowSize && soundoutAccumulatedBuffer.length >= windowSize) {
        
        const windowedMicBuffer = applyWindow(accumulatedBuffer.slice(0, windowSize), hann);
        const windowedSoundoutBuffer = applyWindow(soundoutAccumulatedBuffer.slice(0, windowSize), hann);

        const micSpectrum = analyzer.getValue(windowedMicBuffer);
        const soundoutSpectrum = Soundoutan.getValue(windowedSoundoutBuffer);

        const subtractedSpectrum = performSpectralSubtraction(micSpectrum, soundoutSpectrum,); // Adjust scaling factor

        const { dominantFrequencies } = getDominantFrequencies(
          subtractedSpectrum,
          analyzer
        );         


        // Remove the processed data from the accumulated buffers
        accumulatedBuffer = accumulatedBuffer.slice(windowSize);
        soundoutAccumulatedBuffer = soundoutAccumulatedBuffer.slice(windowSize);

        hztoscale(dominantFrequencies);
        scaleanalysis(noteCountArray);
        

        //  Playback
//need to adjust volume of output based on volume of input.
            //Check if the previous key_note is still present in filteredTopNotes
    if (filteredTopNotes.includes(previousKeyNote)) {
        key_note = previousKeyNote; // Keep the previous key_note
    } else {
        key_note = filteredTopNotes[0]; // Update to the new top note
        previousKeyNote = key_note;    // Store the new key_note as previous
    }

        console.log(key_note);
        const centernote = noteToFrequency(key_note);
        console.log(`Frequency of ${key_note} in octave 2: ${centernote} Hz`);

        window.key_note = centernote;
        document.getElementById('keyNoteValue').textContent = key_note || '-';
          }
    }


    // Start Analysis Loop
    setInterval(processAudio, fftrate * 1000);
    console.log("FFT analysis started.");
  } catch (error) {
    console.error("Error setting up audio:", error);
  }

setInterval(updateKeyNote, fftrate * 1000);
});

function getDominantFrequencies(spectrum, analyzer, n = 10) {
  dominantFrequencies = [];
  const dataholder = []; //temp


  // Convert spectrum to array of { frequency, amplitude } objects
  for (let i = 0; i < spectrum.length / 2; i++) {
    // Calculate frequency using the corrected formula
    const frequency = i * (samplerate / analyzer.size / 2);
    // Check if frequency is within the desired range
    if (
      frequency >= lowFrequencyMask &&
      frequency <= highFrequencyMask &&
      isFinite(spectrum[i])
    ) {
        dataholder.push({
        frequency: frequency,
        amplitude: spectrum[i],
      });
    }
  }

  // Sort by amplitude (descending)
  dataholder.sort((a, b) => b.amplitude - a.amplitude);
  console.log("raw freq Data:", dataholder); // Log filtered data to the console

   const filteredData = dataholder.filter(data => data.amplitude >= dbthreshold);
   console.log("flt freq Data:", filteredData); // Log filtered data to the console



for (let i = 0; dominantFrequencies.length < n && i < filteredData.length; i++) {
    const currentFrequency = filteredData[i].frequency;
    dominantFrequencies.push(currentFrequency);
}

console.log("Dominant Frequencies (Hz):", dominantFrequencies); // Print dominant frequencies
return { dominantFrequencies };

}


function hztoscale(newDominantFrequencies = []) {
  const noteCounts = Object.fromEntries(notes.map((note) => [note, 0]));

  newDominantFrequencies.forEach((newFreq) => {

  
      // Convert the remaining new frequencies to notes
      const semitone = 12 * Math.log2(newFreq / 440);
      let noteIndex = Math.round(semitone) % 12;
      if (noteIndex < 0) noteIndex += 12;
      const note = notes[noteIndex];
      noteCounts[note]++;
    
  });
  noteCountArray = Object.entries(noteCounts);
  updateNoteTable(noteCountArray); // Update the table with new data

  // Apply bonuses to the first five notes
  for (let i = 0; i < Math.min(6, newDominantFrequencies.length); i++) {
    const freq = newDominantFrequencies[i];
    const semitone = 12 * Math.log2(freq / 440);
    let noteIndex = Math.round(semitone) % 12;
    if (noteIndex < 0) noteIndex += 12;
    const note = notes[noteIndex];
    // Apply bonus based on position in dominantFrequencies
    const bonus = 0.6 - i * 0.1001;
    noteCounts[note] += bonus;
  }

  // Convert note counts to array format
  noteCountArray = Object.entries(noteCounts);

  // Log the count for each note
  noteCountArray.forEach(([note, count]) => {
    console.log(`${note}: ${count}`);
  });

  return noteCountArray;
}

function applyWindow(buffer, windowFunction) {
  return buffer.map(
    (value, index) => value * windowFunction(index, buffer.length)
  );
}

function scaleanalysis() {
  const sortedNotes = noteCountArray.sort((a, b) => b[1] - a[1]);
  console.log("Sorted notes:", sortedNotes);

  topNotes = [];

  // Include the first two notes regardless of their value
  for (let i = 0; i < Math.min(2, sortedNotes.length); i++) {
    const topnote = sortedNotes[i][0];
    const value = sortedNotes[i][1];

    const output = getNoteIntervals(topnote, intervals);
    console.log(output);
    topNotes.push(output);
  }

  // Include the third note if it has a significant value relative to the first two
  topNotes.push([]); // Ensure topNotes[2] is initialized even if empty

  // Include the third note if it has a significant value relative to the first two
  if (
    sortedNotes.length >= 3 &&
    sortedNotes[2][1] > sortedNotes[0][1] * 0.5 &&
    sortedNotes[2][1] > 2
  ) {
    const topnote = sortedNotes[2][0];
    const output = getNoteIntervals(topnote, intervals);
    console.log(output);
    topNotes.push(output);
  } else {
    topNotes.push([]);
  }

  const TOPLIST = alltop(topNotes);
  console.log("All top notes:", TOPLIST);

  const illegalNotes = identifyIllegalIntervals(sortedNotes);
  console.log("Illegal Intervals:", illegalNotes);

  filteredTopNotes = removeIllegalNotes(TOPLIST, new Set(illegalNotes));
  console.log("Filtered Combined Top Notes:", filteredTopNotes);

  findMatchingIntervals(filteredTopNotes, intervals);

  // Compare arrays and create new array with common notes
  let commonNotes = [...topNotes[0]];
  for (let i = 1; i < topNotes.length; i++) {
    commonNotes = commonNotes.filter((note) => topNotes[i].includes(note));
  }

  // Arrange the new array based on the order of notes in the first top note
  const orderedCommonNotesTopThree = topNotes[0].filter((note) =>
    commonNotes.includes(note)
  );
}

function alltop(topNotes) {
  allTop = [];

  // Add notes from the first top note array
  for (let note of topNotes[0]) {
    if (!allTop.includes(note)) {
      allTop.push(note);
    }
  }

  // Add notes from the second top note array
  for (let note of topNotes[1]) {
    if (!allTop.includes(note)) {
      allTop.push(note);
    }
  }

  // Add notes from the third top note array
  for (let note of topNotes[2]) {
    if (!allTop.includes(note)) {
      allTop.push(note);
    }
  }

  return allTop;
}

function identifyIllegalIntervals(sortedNotes) {
  const illegalNotesToRemove = new Set();

  for (let i = 0; i < Math.min(3, sortedNotes.length); i++) {
    const illegal = sortedNotes[i][0];
    const illegalNotes = getNoteIntervals(illegal, illegalIntervals);
    illegalNotes.forEach((note) => illegalNotesToRemove.add(note));
  }

  // Return the illegal notes
  return Array.from(illegalNotesToRemove);
}

function removeIllegalNotes(TOPLIST, illegalNotes) {
  return TOPLIST.filter((note) => !illegalNotes.has(note));
}

function findMatchingIntervals(filteredTopNotes, intervals) {
  matchingPairs = [];

  // Function to calculate the interval between two notes
  function getInterval(note1, note2) {
    const index1 = notes.indexOf(note1);
    const index2 = notes.indexOf(note2);
    const distance = Math.abs(index1 - index2);
    return distance;
  }

  // Iterate through each note in the filteredTopNotes list
  for (let i = 0; i < filteredTopNotes.length; i++) {
    const note = filteredTopNotes[i];

    // Iterate through each note again to compare with other notes
    for (let j = i + 1; j < filteredTopNotes.length; j++) {
      const otherNote = filteredTopNotes[j];

      // Calculate the interval between the current note and otherNote
      const interval = getInterval(note, otherNote);

      // Check if the interval matches any of the intervals in the intervals array
      if (intervals.includes(interval)) {
        matchingPairs.push([note, otherNote, interval]);
      }
    }
  }

  console.log("Matching pairs with specified intervals:", matchingPairs);
  return matchingPairs;
}

function getNoteIntervals(note, intervals) {
  // Find the index of the input note
  const noteIndex = notes.indexOf(note.toUpperCase());

  if (noteIndex === -1) {
    return "Invalid note";
  }

  // Calculate the corresponding notes for each interval
  const result = [];
  intervals.forEach((interval) => {
    const newIndex = (noteIndex + interval) % notes.length;
    result.push(notes[newIndex]);
  });

  return result;
}

// Function to convert note name to frequency in octave 2
function noteToFrequency(noteName) {
  const noteFrequencyMap = {
    E: 82.406,
    F: 87.308,
    "F#": 92.498,
    G: 97.998,
    "G#": 103.826,
    A: 110,
    "A#": 116.54,
    B: 123.472,
    C: 130.812,
    "C#": 138.592,
    D: 146.832,
    "D#": 155.592,
  };
  // Convert note name to uppercase to handle case insensitivity
  const note = noteName.toUpperCase();

  // Check if the note is in the map, if not return null
  if (!noteFrequencyMap.hasOwnProperty(note)) {
    return null;
  }

  return noteFrequencyMap[note];
}

function hann(i, N) {
    return 0.5 * (1 - Math.cos((6.283185307179586 * i) / (N - 1)));
  }

  // Function to create adjusted gain level for sound output

  function calculateGain(key_note) {
    const z = - 42; // volume add
    const gain = 254 * Math.pow(0.986, key_note) + 2 + z;
    return gain;
}

//Make sound
function updateKeyNote() {

    let key_note = window.key_note; // Retrieve key_note
   
    if (key_note == 0) { // Check if key_note is not the default value
        console.log("Defauly Key Note:", key_note); // Log the key_note
    } else {
    // Check if key_note is not the default value
    console.log("New Key Note:", key_note); // Log the key_note

    // Calculate gain based on key_note
    const scaledGain = calculateGain(key_note);
    console.log("scaled Gain:", scaledGain); // Log the key_note

    // Update gain node with scaled gain
    Soundout.gain.value = scaledGain;

      // Noise synth with volume control for noise1
      const monoSignal = new Tone.Mono();
      const third = key_note * 2;  // Reset key_note after using it
      const noise2 = new Tone.Noise("white").start();
      const bp2Filter = new Tone.Filter({
          type: 'bandpass',
          frequency: third, 
          Q: 120,
          rolloff: -48
      }).connect(monoSignal);
  
      const fifth = key_note * 3; // Reset key_note after using it
      const noise1 = new Tone.Noise("white").start();
      const noise1Gain = new Tone.Gain(-3); // Gain node for noise1 (adjust -6 as needed)
      const bp1Filter = new Tone.Filter({
          type: 'bandpass',
          frequency: fifth, 
          Q: 120,
          rolloff: -48
      }).connect(noise1Gain);
  
  
      noise1.connect(bp1Filter);
      noise2.connect(bp2Filter);
  
      // Connect noise1Gain to monoSignal, then to Soundout
      noise1Gain.connect(monoSignal);
  
      noise1.stop("+0.95"); // Swapped stop times to stop noise1 first
      noise2.stop("+0.90");
  
      monoSignal.connect(Soundout);
        
    }
}

function performSpectralSubtraction(micSpectrum, soundoutSpectrum, overSubtractionFactor = 0.8) {
    // Remove values with amplitude less than -90 from soundoutSpectrum
    //need to scale overSubtractionFactor with median of mic input

    //look at amplitude of loudest bins in soundout, compare to amplitude of same bins in micspectrum, scale down soundout overSubtractionFactor to match 
    soundoutSpectrum = soundoutSpectrum.map(magnitude => magnitude < -110 ? 0 : magnitude);

    const subtractedSpectrum = new Float32Array(micSpectrum.length);

    for (let i = 0; i < micSpectrum.length; i++) {
        const micMag = micSpectrum[i];
        const soundoutMag = soundoutSpectrum[i] * overSubtractionFactor; // Apply scaling factor
        subtractedSpectrum[i] =  micMag + soundoutMag; // Subtract, avoid negative values
    }

    return subtractedSpectrum;
}

  
function updateNoteTable(noteCountArray) {
    const tableBody = document.getElementById("noteTable").getElementsByTagName('tbody')[0];
    tableBody.innerHTML = ''; // Clear previous results

    noteCountArray.forEach(([note, count]) => {
        const row = tableBody.insertRow();
        const noteCell = row.insertCell();
        const countCell = row.insertCell();
        noteCell.textContent = note;
        countCell.textContent = count;
    });
}
