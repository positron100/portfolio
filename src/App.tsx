import { Navbar } from "@/components/Navbar";
import { Hero } from "@/components/Hero";
import { Footer } from "@/components/Footer";
import { IntroOverlay } from "@/components/IntroOverlay";
import { DeveloperAvatar } from "@/components/DeveloperAvatar";
import { useIntroSequence } from "@/hooks/useIntroSequence";
import { About } from "@/sections/About";
import { Skills } from "@/sections/Skills";
import { Experience } from "@/sections/Experience";
import { Projects } from "@/sections/Projects";
import { Certifications } from "@/sections/Certifications";
import { Architecture } from "@/sections/Architecture";
import { Contact } from "@/sections/Contact";

function App() {
  const {
    elapsed: introElapsed,
    phase: introPhase,
    done: introDone,
    beginReveal,
    scrubReveal,
    settleReveal,
  } = useIntroSequence();

  return (
    <>
      <IntroOverlay
        elapsed={introElapsed}
        phase={introPhase}
        done={introDone}
        onEnter={beginReveal}
        onScrub={scrubReveal}
        onSettle={settleReveal}
      />
      {/* Layout-neutral wrapper whose only job is `inert`: while the opening
          overlay covers the page, the site beneath it must not be reachable
          by keyboard or exposed to assistive tech — the continue button is
          the only control at that moment. */}
      <div inert={!introDone ? true : undefined}>
        <Navbar />
        <main>
          <Hero />
          <About />
          <Skills />
          <Experience />
          <Certifications />
          <Projects />
          <Architecture />
          <Contact />
        </main>
        <Footer />
      </div>
      <DeveloperAvatar introElapsed={introElapsed} introDone={introDone} />
    </>
  );
}

export default App;
