
// Move Tone-related code outside of the event listener
const gainNode = new Tone.Gain(6).toDestination();  

// Function to calculate gain based on frequency
function calculateGain(key_note) {
    const z = 5; // volume add
    const gain = 254 * Math.pow(0.986, key_note) + 2 + z;
    return gain;
}

// Define a function to update key_note
function updateKeyNote() {
    let key_note = window.key_note; // Retrieve key_note

    console.log("New Key Note:", key_note); // Log the key_note

    // Check if key_note is not the default value and below 100

    if (key_note !== 0) { // Check if key_note is not the default value

    // Calculate gain based on key_note
    const scaledGain = calculateGain(key_note);

    // Update gain node with scaled gain
    gainNode.gain.value = scaledGain;

            

        const third = key_note *= 1.25;
        const noise2 = new Tone.Noise("white").start();
        const bp2Filter = new Tone.Filter({
            type: 'bandpass',
            frequency: third, 
            Q: 30,
            rolloff: -48
        }).connect(gainNode);

        const fifth = key_note *= 1.2;
        const noise1 = new Tone.Noise("white").start();
        const bp1Filter = new Tone.Filter({
            type: 'bandpass',
            frequency: fifth, 
            Q: 30,
            rolloff: -48
        }).connect(gainNode);


        noise1.connect(bp1Filter); 
        noise2.connect(bp2Filter); 
        console.log("3rd:", third); // Log the key_note
        console.log("5th:", fifth); // Log the key_note
        noise1.stop("+2.95"); 
        noise2.stop("+2.95"); 
    }
}

// Call the function initially
updateKeyNote();


// Set up interval to update every 3 seconds
setInterval(updateKeyNote, 3000);

