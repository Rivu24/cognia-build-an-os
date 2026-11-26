import { useMeta } from '@/lib/data'
import { COPYRIGHT, WIKI } from '@/components/brand'
import { SectionTitle } from '@/components/learn/bits'
import { TRACKS } from '@/lib/music'
import { CountUp, DrawLine, Reveal, RevealText, Stagger, StaggerItem } from '@/components/motion'

/* a section separated by a hairline that draws as it arrives */
function Part({ children, last }: { children: React.ReactNode; last?: boolean }) {
  return (
    <section className="relative px-6 py-12 sm:px-10 lg:px-14">
      {children}
      {!last && <DrawLine className="absolute inset-x-0 bottom-0" />}
    </section>
  )
}

export default function CreditsPage() {
  const { data: meta } = useMeta()
  return (
    <div>
      <Part>
        <Reveal y={16} scale={1} blur={0} duration={0.9} className="eyebrow">Credits and licence</Reveal>
        <RevealText as="h1" delay={0.05} className="mt-3 block text-[clamp(30px,4vw,48px)] leading-[1.06] font-semibold tracking-[-.025em]">Credit where it is due</RevealText>
        <Reveal y={24} scale={1} delay={0.35}>
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed">This platform exists because the OSDev community wrote down, over two decades, how to build an operating system. Every article you read here is theirs.</p>
        </Reveal>
      </Part>
      <Part>
        <Reveal y={40} scale={1} blur={4} amount={0.15} className="max-w-[760px] space-y-4 text-[16px] leading-relaxed">
          <SectionTitle>The content: OSDev Wiki</SectionTitle>
          <p>All <CountUp value={meta?.articles ?? 758} /> articles are reproduced from the <a className="underline" href={WIKI} target="_blank" rel="noopener">OSDev Wiki</a> (wiki.osdev.org). In the wiki's own words, all content added since 6 June 2011 is licensed under <a className="underline" href="https://creativecommons.org/publicdomain/zero/1.0/" target="_blank" rel="noopener">CC0 1.0 Universal</a>; earlier contributions were relicensed by the authors who agreed (see <a className="underline" href={`${WIKI}User:Combuster/Relicensing`} target="_blank" rel="noopener">User:Combuster/Relicensing</a>). The wiki's <a className="underline" href={`${WIKI}OSDev_Wiki:Copyrights`} target="_blank" rel="noopener">Copyrights</a> page is the authority.</p>
          <p>Some images on the wiki are third-party material, such as book covers, logos and screenshots of other software. They belong to their owners, are shown here for reference as they are on the wiki, and are not covered by CC0.</p>
          <p>The copy used here is the WikiTeam dump of 30 December 2025, archived at the <a className="underline" href={meta?.dump} target="_blank" rel="noopener">Internet Archive</a>. Article text is shown as written; only formatting changed. Each article names its last edit date and the recent editors in our copy, and links to the live original and its full author history. If a page has changed since, the live wiki is the authority.</p>
          <p>Found an error in an article? Fix it at the source on the <a className="underline" href={WIKI} target="_blank" rel="noopener">OSDev Wiki</a> so everyone benefits. Questions about OS development belong on the <a className="underline" href="https://forum.osdev.org/" target="_blank" rel="noopener">OSDev forum</a>.</p>
        </Reveal>
      </Part>
      <Part>
        <Reveal y={40} scale={1} blur={4} amount={0.2} className="max-w-[760px] space-y-4 text-[16px] leading-relaxed">
          <SectionTitle>The platform: COGNIA</SectionTitle>
          <p><b className="font-semibold">{COPYRIGHT}</b> All rights reserved in the platform itself: its design, the curriculum and its sequencing, the teaching method, the motion graphics, the lesson framing text (goals, reasons, checkpoints), and the code. This copyright does not extend to the OSDev Wiki articles, which remain under CC0 and may be reused by anyone, nor to third-party images or the music.</p>
          <p>COGNIA and the COGNIA mark are marks of Cognia Labs. Set in Instrument Sans and JetBrains Mono. Built with React, shadcn/ui and Motion.</p>
        </Reveal>
      </Part>
      <Part>
        <Reveal y={40} scale={1} blur={4} className="max-w-[760px] space-y-4 text-[16px] leading-relaxed">
          <SectionTitle>The journey on the home page</SectionTitle>
          <p>The 3D models of the International Space Station and the Voyager probe come from <a className="underline decoration-line-strong underline-offset-4 hover:decoration-foreground" href="https://github.com/nasa/NASA-3D-Resources" target="_blank" rel="noopener">NASA 3D Resources</a>, used under NASA's media usage guidelines; NASA does not endorse this site. The Earth and Moon maps (surface, night lights, clouds, normals, oceans) are the planet textures distributed with the <a className="underline decoration-line-strong underline-offset-4 hover:decoration-foreground" href="https://github.com/mrdoob/three.js/tree/dev/examples/textures/planets" target="_blank" rel="noopener">three.js examples</a>, made from NASA imagery. The Sun, the galaxy, the Big Bang and the sound design are generated in code.</p>
        </Reveal>
      </Part>

      {TRACKS.length > 0 && (
        <Part>
          <div className="max-w-[760px] space-y-4 text-[16px] leading-relaxed">
            <Reveal y={40} scale={1} blur={4} className="space-y-4">
              <SectionTitle>The music</SectionTitle>
              <p>The tracks in the music player belong to their artists and rights holders. They are not covered by CC0 or by the platform copyright above.</p>
            </Reveal>
            <div>
              <DrawLine />
              <Stagger as="ul" stagger={0.05}>
                {TRACKS.map((t) => (
                  <StaggerItem as="li" key={t.id} y={18} blur={0} className="flex justify-between gap-4 border-b border-line py-2 text-[14.5px]">
                    <span className="font-medium">{t.title}</span>
                    {t.artist && <span className="text-right font-mono text-[12px] text-muted-foreground">{t.artist}</span>}
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </div>
        </Part>
      )}
      <Part last>
        <Reveal y={40} scale={1} blur={4} amount={0.15} className="max-w-[760px]">
          <SectionTitle>Thank you, contributors</SectionTitle>
          <p className="text-[14px] text-muted-foreground">Our copy of the wiki records only each page's most recent revisions, so this list is partial: {meta ? <CountUp value={meta.contributors.length} /> : '…'} people appear in it. Everyone who ever wrote a page is listed in that page's history on the <a className="underline" href={WIKI} target="_blank" rel="noopener">OSDev Wiki</a>. Thank you to all of them.</p>
          <p className="mt-4 text-[13.5px] leading-[1.9] text-muted-foreground">{meta?.contributors.join(', ')}</p>
        </Reveal>
      </Part>
    </div>
  )
}
