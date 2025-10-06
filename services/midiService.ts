export class MidiService {
  // FIX: Use standard MIDIAccess type instead of WebMidi.MIDIAccess
  private midiAccess: MIDIAccess | null = null;
  
  // Callbacks are now public properties that can be updated from the outside.
  public onNoteOn: (note: number, velocity: number) => void = () => {};
  public onNoteOff: (note: number) => void = () => {};
  public onControlChange: (controller: number, value: number) => void = () => {};
  
  constructor() {
    // The constructor is now empty, no longer taking callbacks.
  }

  public async requestMIDIAccess(): Promise<string[]> {
    if (!navigator.requestMIDIAccess) {
      console.error("Web MIDI API is not supported in this browser.");
      return [];
    }

    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      this.midiAccess.onstatechange = this.onStateChange.bind(this);
      this.registerInputs();
      return this.getInputNames();
    } catch (error) {
      console.error("Could not access MIDI devices.", error);
      return [];
    }
  }

  // FIX: Use standard MIDIConnectionEvent type instead of WebMidi.MIDIConnectionEvent
  private onStateChange(event: MIDIConnectionEvent) {
    console.log(`MIDI device state changed: ${event.port.name} is ${event.port.state}`);
    this.registerInputs();
  }

  private registerInputs() {
    if (this.midiAccess) {
      this.midiAccess.inputs.forEach((input) => {
        input.onmidimessage = this.handleMIDIMessage.bind(this);
      });
    }
  }
  
  public getInputNames(): string[] {
    if (!this.midiAccess) return [];
    // NOTE: The error on this line about `input.name` is resolved by fixing the type of `midiAccess`.
    return Array.from(this.midiAccess.inputs.values()).map(input => input.name || 'Unnamed Device');
  }

  // FIX: Use standard MIDIMessageEvent type instead of WebMidi.MIDIMessageEvent
  private handleMIDIMessage(message: MIDIMessageEvent) {
    const [command, note, velocity] = message.data;

    // Use the public callback properties to handle events
    switch (command & 0xF0) {
      case 0x90: // Note On
        if (velocity > 0) {
          this.onNoteOn(note, velocity);
        } else {
          // Some controllers send Note On with velocity 0 for Note Off
          this.onNoteOff(note);
        }
        break;
      case 0x80: // Note Off
        this.onNoteOff(note);
        break;
      case 0xB0: // Control Change
        this.onControlChange(note, velocity);
        break;
    }
  }
}