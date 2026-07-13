'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import SiteNav from '@/components/SiteNav';
import { useT, useLanguage } from '@/contexts/LanguageContext';
import { getCountryDisplayName } from '@/lib/countries';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const AMBASSADORS = [
  // Latin America
  { name: 'Santiago Rosas Peña',      country: 'Venezuela',      initials: 'SR', photo: '/ambassador-photos/santiago_ambassador.png', photoPosition: 'center 35%' },
  // Europe
  { name: 'Kyle Wilkinson',          country: 'United Kingdom', initials: 'KW', photo: '/ambassador-photos/kyle_ambassador.png', photoPosition: 'center 50%' },
  { name: 'Celine Nasser',           country: 'United Kingdom', initials: 'CN', photo: '/ambassador-photos/celine_ambassador.png' },
  { name: 'Daniel O\'Neil Ferrero',  country: 'Scotland',       initials: 'DF', photo: '/ambassador-photos/Daniel_ambassador.png', photoPosition: 'center 20%', photoScale: 1.2 },
  { name: 'Noelia Alvarez Iglesias', country: 'Spain',          initials: 'NA', photo: '/ambassador-photos/noelia_ambassador.png' },
  { name: 'Félix Losada Ottino',     country: 'Spain',          initials: 'FL', photo: '/ambassador-photos/felix_ambassador.png', photoPosition: 'center 25%' },
  { name: 'Luca Formichella',        country: 'Italy',          initials: 'LF', photo: '/ambassador-photos/luca_ambassador.png', photoPosition: 'center 20%' },
  { name: 'Amna Sikandar',           country: 'France',         initials: 'AS', photo: '/ambassador-photos/Amna_ambassador.png' },
  { name: 'Vlad Gheorghe',           country: 'Romania',        initials: 'VG', photo: '/ambassador-photos/Vlad_ambassador.png', photoPosition: 'center 25%', photoScale: 1.6 },
  // North America
  { name: 'Spencer Lindsay',         country: 'Canada',         initials: 'SL', photo: '/ambassador-photos/spencer_ambassador.jpeg' },
  { name: 'Armande Loretz',          country: 'France',         initials: 'AL', photo: '/ambassador-photos/armande_ambassador.png' },
  // South America
  { name: 'Manuela Trujillo',        country: 'Peru',           initials: 'MT', photo: '/ambassador-photos/manuela_ambassador.png' },
  { name: 'Valentina Cruz',          country: 'Peru',           initials: 'VC', photo: '/ambassador-photos/valentina_ambassador.png' },
  { name: 'Paolo Marinuzzi',         country: 'Venezuela',      initials: 'PM', photo: '/ambassador-photos/paolo_ambassador.png' },
  { name: 'Anna Cocconi',            country: 'Venezuela',      initials: 'AC', photo: '/ambassador-photos/anna_ambassador.png' },
  // Asia (west to east)
  { name: 'Farah Lahiani',           country: 'UAE',            initials: 'FH', photo: '/ambassador-photos/farah_ambassador.png', photoPosition: 'center 62%' },
  { name: 'Abdul Rehman',            country: 'Pakistan',       initials: 'AR', photo: '/ambassador-photos/abdulrehman_ambassador.png', photoPosition: 'center 30%' },
  { name: 'Saayoojya Variyath',      country: 'India',          initials: 'SV', photo: '/ambassador-photos/saayoojya_ambassador.png' },
  { name: 'Sri Harsha Vardhan Pachava', country: 'India',       initials: 'SH', photo: '/ambassador-photos/sriharsha_ambassador.png' },
  { name: 'Tyler Serano',            country: 'Philippines',    initials: 'TS', photo: '/ambassador-photos/tyler_ambassador.png' },
  { name: 'Andrew Mailoa',           country: 'Indonesia',      initials: 'AM', photo: '/ambassador-photos/andrew_ambassador.png' },
  { name: 'Charlito Gunawan',        country: 'Indonesia',      initials: 'CG', photo: '/ambassador-photos/charlito_ambassador.png' },
  { name: 'Victor Mikusek',          country: 'Hong Kong',      initials: 'VM', photo: '/ambassador-photos/victor_ambassador.png' },
  { name: 'Alman Ahmad',             country: 'UAE',            initials: 'AA', photo: '/ambassador-photos/alman_ambassador.png', photoPosition: 'center 25%' },
  { name: 'Farhan Arbab',            country: 'Bangladesh',     initials: 'FA', photo: '/ambassador-photos/farhan_ambassador.png', photoPosition: 'center 33%' },
  { name: 'Anushka Arora',           country: 'India',          initials: 'AA', photo: '/ambassador-photos/anushka_ambassador.png', photoPosition: 'center 38%' },
  { name: 'Ridhi Sareen',            country: 'India',          initials: 'RS', photo: '/ambassador-photos/ridhi_ambassador.png', photoPosition: 'center 22%' },
  { name: 'Myesha',                  country: 'Thailand',       initials: 'MY', photo: '/ambassador-photos/myesha_ambassador.png', photoPosition: 'center 40%' },
  { name: 'Reem Ghazal',             country: 'France',         initials: 'RG', photo: '/ambassador-photos/reem_ambassador.png', photoPosition: 'center 30%' },
  // Africa
  { name: 'Lealem Tayework',         country: 'Ethiopia',       initials: 'LT', photo: '/ambassador-photos/lealem_ambassador.png', photoPosition: 'center 22%' },
  // Latin America
  { name: 'Diego Aldana',            country: 'Honduras',       initials: 'DA', photo: '/ambassador-photos/diego_ambassador.png', photoPosition: 'center 22%' },
  { name: 'Isabella Romero',         country: 'Honduras',       initials: 'IR', photo: '/ambassador-photos/isabella_ambassador.png' },
  // Asia
  { name: 'El Fatiarrazzy Sena',     country: 'Indonesia',      initials: 'ES', photo: '/ambassador-photos/el_ambassador.png', photoPosition: '44% 62%' },
  { name: 'Hasan Ali Hilaly',        country: 'Pakistan',       initials: 'HH', photo: '/ambassador-photos/hasan_ambassador.png', photoPosition: 'center 40%' },
  // Europe
  { name: 'Eva Dubost',              country: 'France',         initials: 'ED', photo: '/ambassador-photos/eva_ambassador.png', photoPosition: 'center 42%' },
  { name: 'Sophia Baah',             country: 'United Kingdom', initials: 'SB', photo: '/ambassador-photos/sophia_ambassador.png', photoPosition: 'center 45%' },
  { name: 'Yağmur Akman',            country: 'Turkey',         initials: 'YA', photo: '/ambassador-photos/yagmur_ambassador.png', photoPosition: '46% 42%' },
  { name: 'Petru-Serban Radulescu',  country: 'Romania',        initials: 'PR', photo: '/ambassador-photos/petru_ambassador.png', photoPosition: 'center 13%' },
  // North America
  { name: 'Adam Epstein',            country: 'Canada',         initials: 'AE', photo: '/ambassador-photos/adam_ambassador.png', photoPosition: 'center 40%' },
];

const inputStyle: React.CSSProperties = {
  backgroundColor: 'rgba(221, 212, 192, 0.4)',
  border: '1px solid rgba(28, 20, 16, 0.2)',
  color: '#1C1410',
  borderRadius: '10px',
};

const FounderPhoto = ({ src, name }: { src: string; name: string }) => (
  <div style={{ width: 260, height: 260, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: '2px solid rgba(196, 168, 130, 0.15)' }}>
    <img
      src={src}
      alt={name}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', mixBlendMode: 'normal' }}
    />
  </div>
);

export default function AboutClient() {
  const { language } = useLanguage();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', country: '', experience: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!form.name || !form.email || !form.country) return;
    await supabase.from('ambassador_applications').insert({
      name: form.name.trim(),
      email: form.email.trim(),
      country: form.country.trim(),
      experience: form.experience.trim() || null,
    });
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#EDE7D8] flex flex-col relative overflow-x-hidden">
      {/* Grain */}
      <div className="pointer-events-none fixed inset-0 z-0"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='grain'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23grain)' opacity='1'/%3E%3C/svg%3E")`, backgroundRepeat: 'repeat', backgroundSize: '300px 300px', mixBlendMode: 'multiply', opacity: 0.18 }} />

      <SiteNav />

      {/* Banner */}
      <section className="relative z-10 w-full flex items-end"
        style={{ height: 340, background: 'linear-gradient(135deg, #1B3828 0%, #2A5A3C 50%, #1B3828 100%)', borderBottom: '1px solid rgba(27, 56, 40, 0.3)' }}>
<div className="relative z-10 w-full text-center px-12 pb-10">
          <p className="font-black text-white tracking-tight leading-none" style={{ fontSize: 'clamp(36px, 5vw, 72px)' }}>
            {t('about_banner_tagline')}{' '}
            <span style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic', fontWeight: 400, color: '#EED98A' }}>{t('about_banner_love')}</span>
            {' '}{t('about_banner_mun')}
          </p>
        </div>
      </section>

      {/* Founders */}
      <section className="relative z-10 py-24 px-6 max-w-6xl mx-auto w-full">
        <div className="flex flex-col md:flex-row items-center gap-16 mb-28">
          <div className="shrink-0"><FounderPhoto src="/PeterPic.jpg" name="Peter Zakhar" /></div>
          <div className="flex-1">
            <p className="text-xs font-mono tracking-[0.18em] text-[#9A8A78] mb-2 uppercase">{t('about_cofounder')}</p>
            <h2 className="text-4xl font-black text-[#1C1410] mb-1">Peter Zakhar</h2>
            <p className="text-[#B6871F] text-sm font-semibold mb-6 tracking-wide">{t('about_peter_role')}</p>
            <p className="text-[#6A5A4A] leading-relaxed text-base">{t('about_peter_bio')}</p>
          </div>
        </div>
        <div className="flex flex-col md:flex-row-reverse items-center gap-16">
          <div className="shrink-0"><FounderPhoto src="/Christian.jpg" name="Christian Galindo" /></div>
          <div className="flex-1">
            <p className="text-xs font-mono tracking-[0.18em] text-[#9A8A78] mb-2 uppercase">{t('about_cofounder')}</p>
            <h2 className="text-4xl font-black text-[#1C1410] mb-1">Christian Galindo</h2>
            <p className="text-[#B6871F] text-sm font-semibold mb-6 tracking-wide">{t('about_christian_role')}</p>
            <p className="text-[#6A5A4A] leading-relaxed text-base">{t('about_christian_bio')}</p>
          </div>
        </div>
      </section>

      {/* Global Ambassadors */}
      <section className="relative z-10 py-24 px-6" style={{ borderTop: '1px solid rgba(221, 212, 192, 0.8)' }}>
        <div className="text-center mb-16">
          <p className="text-xs font-mono tracking-[0.2em] text-[#9A8A78] mb-3 uppercase">{t('about_representing')}</p>
          <h2 className="text-4xl font-black text-[#1C1410]">{t('about_ambassadors_title')}</h2>
        </div>
        {/* Seamless 3-row auto-scroll marquee (left → right). Pauses on hover.
            Three identical grid copies; shifting by one copy loops seamlessly. */}
        <div
          className="ambassador-marquee"
          style={{ ['--ambassador-duration' as string]: `${AMBASSADORS.length * 1.6}s` }}
        >
          <div className="ambassador-marquee__track">
            {[0, 1, 2].map((copy) => (
              <div key={copy} aria-hidden={copy !== 0} className="ambassador-marquee__grid">
                {AMBASSADORS.map((amb) => (
                  <div key={amb.name} className="flex flex-col items-center gap-3" style={{ width: 120 }}>
                    <div style={{ width: 120, height: 120, borderRadius: '50%', overflow: 'hidden', border: '2px solid rgba(28,20,16,0.15)', backgroundColor: 'rgba(221,212,192,0.5)', flexShrink: 0 }}>
                      {amb.photo ? (
                        <img src={amb.photo} alt={amb.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: amb.photoPosition ?? 'center top', display: 'block', transform: `scale(${(amb as {photoScale?: number}).photoScale ?? 1})`, transformOrigin: amb.photoPosition ?? 'center top' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(221,212,192,0.8)', color: '#B6871F', fontWeight: 700, fontSize: 16 }}>{amb.initials}</div>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="text-[#1C1410] text-xs font-bold leading-tight">{amb.name}</p>
                      <p className="text-[#9A8A78] text-[10px] mt-0.5">{getCountryDisplayName(amb.country, language)}</p>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Ambassador CTA */}
      <section className="relative z-10" style={{ borderTop: '1px solid rgba(221, 212, 192, 0.8)' }}>
        <div
          className="w-full text-center"
          style={{ background: 'linear-gradient(135deg, #1B3828 0%, #2A5A3C 100%)', padding: '64px 48px' }}
        >
          <p className="font-black text-white mb-4"
            style={{ fontSize: 'clamp(28px, 4vw, 52px)', letterSpacing: '-0.02em' }}>
            {t('about_cta_title')}
          </p>
          <p className="text-[#EED98A]/60 text-base max-w-xl mx-auto leading-relaxed">
            {t('about_cta_desc')}
          </p>
          <button
            onClick={() => { setOpen(true); setSubmitted(false); }}
            className="inline-flex items-center gap-2 mt-8 px-8 py-3 rounded-full font-bold text-sm tracking-wide transition-all duration-150"
            style={{ border: '1.5px solid rgba(238, 217, 138, 0.4)', color: '#EED98A', background: 'transparent', cursor: 'pointer' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(238, 217, 138, 0.12)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
            onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(238, 217, 138, 0.25)'; (e.currentTarget as HTMLButtonElement).style.color = '#FFFFFF'; }}
            onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(238, 217, 138, 0.12)'; (e.currentTarget as HTMLButtonElement).style.color = '#EED98A'; }}
          >
            {t('about_apply_btn')}
          </button>
        </div>
      </section>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg"
          style={{ backgroundColor: '#FAF8F3', border: '1px solid rgba(221, 212, 192, 0.8)', borderRadius: '20px', color: '#1C1410' }}>
          <DialogHeader>
            <DialogTitle className="text-[#1C1410] text-xl font-black">
              {submitted ? t('about_dialog_title_submitted') : t('about_dialog_title_new')}
            </DialogTitle>
            <DialogDescription style={{ color: '#9A8A78' }}>
              {submitted ? t('about_dialog_desc_submitted') : t('about_dialog_desc_new')}
            </DialogDescription>
          </DialogHeader>

          {submitted ? (
            <div className="py-8 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: 'rgba(27, 56, 40, 0.1)', border: '1px solid rgba(27, 56, 40, 0.3)' }}>
                <span style={{ fontSize: 28, color: '#1B3828' }}>✓</span>
              </div>
              <Button onClick={() => setOpen(false)} style={{ backgroundColor: '#1B3828', color: '#EED98A', borderRadius: '12px', fontWeight: 700 }}>
                {t('about_btn_close')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-5 pt-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amb-name" style={{ color: '#6A5A4A', fontSize: 13, fontWeight: 600 }}>{t('about_label_name')}</Label>
                <Input id="amb-name" placeholder={t('about_placeholder_name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amb-email" style={{ color: '#6A5A4A', fontSize: 13, fontWeight: 600 }}>{t('about_label_email')}</Label>
                <Input id="amb-email" type="email" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amb-country" style={{ color: '#6A5A4A', fontSize: 13, fontWeight: 600 }}>{t('about_label_country')}</Label>
                <Input id="amb-country" placeholder={t('about_placeholder_country')} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} style={inputStyle} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="amb-exp" style={{ color: '#6A5A4A', fontSize: 13, fontWeight: 600 }}>{t('about_label_experience')}</Label>
                <Textarea id="amb-exp" placeholder={t('about_placeholder_experience')} value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} rows={4} style={{ ...inputStyle, resize: 'none' }} />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setOpen(false)} className="flex-1"
                  style={{ borderColor: 'rgba(28, 20, 16, 0.2)', color: '#9A8A78', backgroundColor: 'transparent', borderRadius: '12px' }}>
                  {t('about_btn_cancel')}
                </Button>
                <Button onClick={handleSubmit} disabled={!form.name || !form.email || !form.country} className="flex-1"
                  style={{ backgroundColor: '#1B3828', color: '#EED98A', borderRadius: '12px', fontWeight: 800, opacity: (!form.name || !form.email || !form.country) ? 0.45 : 1 }}>
                  {t('about_btn_submit')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[#DDD4C0] bg-[#EDE7D8] px-6 py-8">
        <div className="flex flex-col items-center gap-4 md:grid md:grid-cols-3 md:gap-0 md:items-center">
          <img src="/GavellingLogo.png" alt="Gavelling" className="h-7 w-auto"
            style={{ filter: 'brightness(0) saturate(100%) invert(18%) sepia(25%) saturate(800%) hue-rotate(100deg) brightness(85%)' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          <div className="flex items-center justify-center gap-4">
            <a href="https://www.instagram.com/wearegavelling/" target="_blank" rel="noopener noreferrer"
              aria-label="Instagram"
              style={{ color: '#9A8A78', transition: 'color 0.15s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#1B3828'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#9A8A78'; }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
              </svg>
            </a>
            <span aria-label="LinkedIn (coming soon)" style={{ color: '#C8BFB0', cursor: 'default' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/>
              </svg>
            </span>
          </div>
          <div className="flex flex-col items-center gap-1 md:items-end">
            <p className="text-xs text-[#9A8A78]">{t('about_footer_copy').replace('{year}', String(new Date().getFullYear()))}</p>
            <a href="/privacy" className="text-xs transition-colors" style={{ color: '#9A8A78' }} onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#1B3828'; }} onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#9A8A78'; }}>Privacy Policy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
