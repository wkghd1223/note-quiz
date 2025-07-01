# 🎵 Note Quiz Game

A comprehensive web-based music note identification game designed to help musicians improve their sight-reading skills through visual and auditory training.

## 🎯 Why This Project?

I created this game to support my harmonica learning journey. When reading sheet music, I found myself struggling to instantly recognize notes, which slowed down my practice sessions. This tool provides focused training to develop quick note recognition skills that are essential for any musician.

## ✨ Features

### 🎹 Interactive Learning

- **Piano Keyboard Input**: Click on piano keys to answer questions
- **Solfege Input Mode**: Use Do-Re-Mi notation for traditional music education
- **Visual Staff Display**: Learn to read notes on treble and bass clefs
- **Audio Playback**: Train your ear with real piano sounds

### ⚙️ Customizable Settings

- **Multiple Clefs**: Treble clef, bass clef, or random selection
- **Key Signatures**: Practice with various key signatures (sharps and flats)
- **Accidentals**: Enable sharps, flats, and naturals for advanced training
- **Ledger Lines**: Extend the staff range for comprehensive note coverage
- **Difficulty Levels**: Beginner, intermediate, advanced, and endurance modes
- **Time Limits**: Optional time constraints for focused practice

### 📊 Progress Tracking

- **Real-time Feedback**: Instant correct/incorrect responses
- **Performance Statistics**: Track accuracy and response times
- **Question History**: Review recent answers with time spent
- **Personal Records**: Monitor your best performance times

### 🌍 Accessibility

- **Bilingual Support**: English and Korean languages
- **Mobile Responsive**: Optimized for phones, tablets, and desktop
- **Enharmonic Recognition**: Accepts equivalent notes (C# = Db, E# = F, etc.)

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or higher
- npm, yarn, or pnpm

### Installation

1. **Clone the repository:**

```bash
git clone https://github.com/your-username/note-quiz.git
cd note-quiz
```

2. **Install dependencies:**

```bash
npm install
# or
yarn install
# or
pnpm install
```

3. **Start the development server:**

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: Zustand
- **Audio**: Web Audio API with custom synthesizer
- **Icons**: React Icons (Font Awesome)
- **Build Tool**: Turbopack (Next.js 15)

## 📁 Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── game/              # Game page with parallel routes
│   │   ├── @control/      # Game control components
│   │   └── @display/      # Game display components
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── game/             # Game-specific components
│   │   ├── Staff.tsx     # Musical staff display
│   │   ├── PianoKeyboard.tsx
│   │   ├── GameSettings.tsx
│   │   └── Timer.tsx
│   └── ui/               # Reusable UI components
├── lib/                  # Utility libraries
│   ├── music/           # Music theory engine
│   │   ├── utils.ts     # Note generation & validation
│   │   ├── audio.ts     # Web Audio API wrapper
│   │   └── constants.ts # Musical constants
│   └── i18n/            # Internationalization
├── store/               # Zustand state management
├── types/               # TypeScript definitions
└── hooks/               # Custom React hooks
```

## 🎵 Music Theory Features

### Supported Elements

- **Clefs**: Treble (G clef), Bass (F clef)
- **Key Signatures**: All major and minor keys
- **Accidentals**: Sharp (♯), Flat (♭), Natural (♮)
- **Note Range**: Extended with ledger lines
- **Enharmonic Equivalents**: Automatic recognition of equivalent notes

### Educational Approach

- **Progressive Difficulty**: Start simple, gradually increase complexity
- **Immediate Feedback**: Learn from mistakes instantly
- **Spaced Repetition**: Review challenging notes more frequently
- **Multi-modal Learning**: Visual, auditory, and kinesthetic input methods

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines

1. Follow TypeScript best practices
2. Use Tailwind CSS for styling
3. Maintain mobile responsiveness
4. Add appropriate type definitions
5. Test on multiple devices and browsers

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by the need for effective music education tools
- Built for harmonica players and musicians of all levels
- Designed with accessibility and user experience in mind

---

**Happy practicing! 🎶**
