'use client';
import Link from 'next/link';
import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { BackLink, Shell } from '@/components/ui';
import { useGame } from '@/store/game';
import { useT } from '@/i18n';
import { expectedAttendance, isDerby, refPrice } from '@/engine/finance';
import { fmtDate, standings } from '@/engine/season';
import { requestArena } from '@/engine/club';
import {
  CAMPAIGNS, FACILITIES, PROMOS, SLOTS, activeCampaign, answerOffer, buildFacility, promoPreview, searchSponsor, seasonDemand, setPromo, slotValue, startCampaign,
  type CampaignKey, type FacilityKey, type PromoKey, type SlotKey,
} from '@/engine/marketing';
import type { Fixture } from '@/engine/types';

const eur = (n: number) => `${Math.round(n).toLocaleString('sl-SI')} €`;
const TABS: [string, string][] = [['pregled', 'Pregled'], ['vstopnice', 'Vstopnice'], ['kampanje', 'Kampanje'], ['sponzorji', 'Sponzorji'], ['dvorana', 'Dvorana']];

function Tile({ v, k, sub, color }: { v: string; k: string; sub?: string; color?: string }) {
  return (
    <div className="tile">
      <div className="v">{v}</div>
      <div className="k">{k}</div>
      {sub && <div style={{ fontSize: 11, fontWeight: 700, marginTop: 3, color: color ?? 'var(--muted)' }}>{sub}</div>}
    </div>
  );
}

function Levels({ n, max = 3, building }: { n: number; max?: number; building?: boolean }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${max}, minmax(0, 1fr))`, gap: 4 }}>
      {Array.from({ length: max }, (_, i) => (
        <div key={i} style={{ height: 6, borderRadius: 99, background: i < n ? 'var(--accent)' : building && i === n ? 'var(--orange)' : 'rgba(255,255,255,0.08)' }} />
      ))}
    </div>
  );
}

function Marketing() {
  const game = useGame((s) => s.game)!;
  const update = useGame((s) => s.update);
  const t = useT();
  const sp = useSearchParams();
  const router = useRouter();
  const [msg, setMsg] = useState('');
  if (!game?.mkt) return null;
  const tab = sp.get('tab') ?? 'pregled';
  const m = game.mkt;
  const club = game.clubs.find((c) => c.id === game.userClubId)!;
  const fin = game.finance[club.id];
  const st = standings(game);
  const pos = Math.max(1, st.findIndex((s) => s.clubId === club.id) + 1);
  const homeGames = game.fixtures.filter((f) => !f.played && f.home === club.id && f.stage !== 'prijateljska').sort((a, b) => a.date.localeCompare(b.date));
  const next = homeGames[0];
  const played = game.fixtures.filter((f) => f.played && f.home === club.id && f.result && f.stage !== 'prijateljska').sort((a, b) => a.date.localeCompare(b.date)).slice(-6);
  const month = game.date.slice(0, 7);
  const led = fin.ledger[month] ?? {};
  const income = ['vstopnice', 'bar', 'sponzorji', 'trgovina', 'loze'].reduce((a, k) => a + Math.max(0, led[k] ?? 0), 0);
  const avgAtt = played.length ? Math.round(played.reduce((a, f) => a + f.result!.attendance, 0) / played.length) : 0;
  const sold = Object.keys(m.slots).length;
  const act = (r: { ok: boolean; text: string } | string) => setMsg(typeof r === 'string' ? r : r.text);
  const go = (k: string) => router.replace(`/marketing?tab=${k}`);

  const priceFor = (f: Fixture) => (f.stage !== 'redni' ? fin.prices.playoff : isDerby(f.home, f.away) ? fin.prices.derby : fin.prices.regular);
  const setPrice = (k: keyof typeof fin.prices, v: number) => update((g) => { g.finance[g.userClubId].prices[k] = Math.max(1, Math.min(40, v)); });

  return (
    <div className="page">
      <BackLink href="/klub" label="Klub" />
      <div className="row">
        <h1 className="h title">{t('Marketing')}</h1>
        <span className="pill" style={{ background: 'color-mix(in srgb, var(--good) 15%, transparent)', color: 'var(--good)' }}>{t('Navdušenje')} {Math.round(game.fans ?? 50)}</span>
      </div>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {TABS.map(([k, l]) => (
          <button key={k} className={`chip ${tab === k ? 'on' : ''}`} style={{ flex: 'none' }} onClick={() => { setMsg(''); go(k); }}>
            {t(l)}{k === 'sponzorji' && m.offers.length > 0 && <span style={{ marginLeft: 6, color: 'var(--orange)', fontWeight: 800 }}>{m.offers.length}</span>}
          </button>
        ))}
      </div>
      {msg && <div className="card" style={{ padding: '10px 14px', fontSize: 13, borderColor: 'color-mix(in srgb, var(--accent) 45%, transparent)' }}>{t(msg)}</div>}

      {tab === 'pregled' && (
        <>
          <div className="tiles">
            <Tile v={String(Math.round(game.fans ?? 50))} k={t('navdušenje')} sub={m.campaigns.length ? t('kampanja teče') : undefined} color="var(--good)" />
            <Tile v={avgAtt ? String(avgAtt) : '—'} k={t('povp. obisk')} sub={avgAtt ? `${Math.round((avgAtt / club.arena.capacity) * 100)} % ${t('dvorane')}` : undefined} />
            <Tile v={`${(income / 1000).toFixed(1)}k €`} k={t('prihodki ta mesec')} />
          </div>
          {next && (() => {
            const opp = game.clubs.find((c) => c.id === next.away)!;
            const att = expectedAttendance(game, next, priceFor(next), pos);
            return (
              <section className="hero" style={{ background: `linear-gradient(135deg, ${club.color}, #10224d)`, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="row"><span className="lbl" style={{ color: 'rgba(255,255,255,.75)' }}>{t('Naslednja domača tekma')}</span><span style={{ fontSize: 12, fontWeight: 700 }}>{fmtDate(next.date)}</span></div>
                <div style={{ fontSize: 20, fontWeight: 800 }}>{club.short} – {opp.short}{isDerby(next.home, next.away) && <span style={{ fontSize: 12, color: 'var(--gold)', marginLeft: 8 }}>{t('DERBI')}</span>}</div>
                <div className="row" style={{ fontSize: 12 }}><span>{t('Napoved obiska')}</span><b>{att} / {club.arena.capacity}</b></div>
                <div className="bar" style={{ background: 'rgba(255,255,255,.18)' }}><div style={{ width: `${(att / club.arena.capacity) * 100}%`, background: '#fff' }} /></div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn white" style={{ flex: 1 }} onClick={() => go('vstopnice')}>{t('Cene in akcija')}</button>
                  <button className="btn glass" style={{ flex: 1 }} onClick={() => go('kampanje')}>{t('Promocija')}</button>
                </div>
              </section>
            );
          })()}
          {played.length > 0 && (
            <section className="card">
              <div className="row" style={{ marginBottom: 10 }}><span style={{ fontSize: 14, fontWeight: 700 }}>{t('Obisk zadnjih domačih tekem')}</span><span className="muted" style={{ fontSize: 11 }}>{t('kapaciteta')} {club.arena.capacity}</span></div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 96 }}>
                {played.map((f) => {
                  const a = f.result!.attendance;
                  const max = Math.max(...played.map((x) => x.result!.attendance));
                  return (
                    <div key={f.id} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>{a}</span>
                      <div style={{ width: '100%', height: Math.max(6, (a / club.arena.capacity) * 70), borderRadius: 6, background: a === max ? 'var(--accent)' : '#2a3b5c' }} />
                      <span style={{ fontSize: 10, color: 'var(--muted)' }}>{game.clubs.find((c) => c.id === f.away)!.short.slice(0, 3).toUpperCase()}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <button className="card" style={{ textAlign: 'left', color: 'inherit', cursor: 'pointer' }} onClick={() => go('sponzorji')}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{t('Sponzorji')}</div>
              <div className="h" style={{ fontSize: 24, marginTop: 4 }}>{sold + 1} / {Object.keys(SLOTS).length + 1}</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{m.offers.length ? `${m.offers.length} ${t('ponudbe čakajo')}` : t('prodanih mest')}</div>
            </button>
            <button className="card" style={{ textAlign: 'left', color: 'inherit', cursor: 'pointer' }} onClick={() => go('dvorana')}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{t('Trgovina')}</div>
              <div className="h" style={{ fontSize: 24, marginTop: 4 }}>{eur(m.merch)}</div>
              <div className="muted" style={{ fontSize: 11, marginTop: 2 }}>{t('prodaja zadnji mesec')}</div>
            </button>
          </div>
          <section className="card" style={{ fontSize: 12.5, color: '#aebbd2', lineHeight: 1.5 }}>
            {t('Na obisk vplivajo cena, forma ekipe, tekmec in derbi, kampanje, akcije za tekmo in navdušenje navijačev. Navdušenje dviguješ z zmagami, kampanjami in akcijami.')}
          </section>
        </>
      )}

      {tab === 'vstopnice' && (
        <>
          <section className="card">
            <div className="row"><span className="lbl">{t('Sezonska karta')}</span><span className="muted" style={{ fontSize: 12 }}>{m.seasonYear === game.seasonYear ? `${t('prodanih')}: ${m.seasonSold}` : ''}</span></div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn sec" style={{ width: 52 }} aria-label={t('Znižaj ceno')} onClick={() => update((g) => { g.mkt!.seasonPrice = Math.max(20, g.mkt!.seasonPrice - 5); })}>−</button>
              <span className="h" style={{ fontSize: 32 }}>{m.seasonPrice} €</span>
              <button className="btn sec" style={{ width: 52 }} aria-label={t('Zvišaj ceno')} onClick={() => update((g) => { g.mkt!.seasonPrice = Math.min(300, g.mkt!.seasonPrice + 5); })}>+</button>
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>
              {t('Prodaja za naslednjo sezono se zaključi 1. septembra. Pri tej ceni pričakuj {n} kart ({e}).', { n: String(seasonDemand(game, m.seasonPrice)), e: eur(seasonDemand(game, m.seasonPrice) * m.seasonPrice) })}
            </div>
          </section>
          {([['regular', 'Redna tekma'], ['derby', 'Derbi'], ['playoff', 'Končnica']] as const).map(([k, l]) => (
            <section key={k} className="card">
              <div className="row">
                <span className="lbl">{t(l)}</span>
                <span className="muted" style={{ fontSize: 12 }}>{t('priporočeno')} {refPrice(club) + (k === 'derby' ? 2 : k === 'playoff' ? 3 : 0)} €</span>
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn sec" style={{ width: 52 }} onClick={() => setPrice(k, fin.prices[k] - 1)} aria-label={t('Znižaj ceno')}>−</button>
                <span className="h" style={{ fontSize: 32 }}>{fin.prices[k]} €</span>
                <button className="btn sec" style={{ width: 52 }} onClick={() => setPrice(k, fin.prices[k] + 1)} aria-label={t('Zvišaj ceno')}>+</button>
              </div>
            </section>
          ))}
          <div className="lbl" style={{ margin: '4px 4px 0' }}>{t('Akcije za domače tekme')}</div>
          {homeGames.slice(0, 4).map((f) => {
            const opp = game.clubs.find((c) => c.id === f.away)!;
            const cur = m.promos[f.id] ?? 'none';
            const price = priceFor(f);
            const base = expectedAttendance(game, f, price, pos);
            const pv = promoPreview(game, f, base, price, cur);
            return (
              <section key={f.id} className="card">
                <div className="row">
                  <span style={{ fontWeight: 700 }}>{club.short} – {opp.short}{pv.derby && <span style={{ color: 'var(--gold)', fontSize: 11, marginLeft: 6 }}>{t('DERBI')}</span>}</span>
                  <span className="muted" style={{ fontSize: 12 }}>{fmtDate(f.date)}</span>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                  {(Object.keys(PROMOS) as PromoKey[]).map((k) => (
                    <button key={k} className={`chip ${cur === k ? 'on' : ''}`} onClick={() => update((g) => setPromo(g, f.id, k))}>{t(PROMOS[k].label)}</button>
                  ))}
                </div>
                <div className="row" style={{ marginTop: 10, fontSize: 13 }}>
                  <span>{t('Napoved')}: <b>{pv.att}</b> / {pv.cap}</span>
                  <span>{t('vstopnice')}: <b>{eur(pv.rev)}</b></span>
                </div>
                {cur !== 'none' && <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>{t(PROMOS[cur].desc)}</div>}
              </section>
            );
          })}
          {!homeGames.length && <p className="muted">{t('Ni prihajajočih domačih tekem.')}</p>}
        </>
      )}

      {tab === 'kampanje' && (
        <>
          {m.campaigns.length > 0 && (
            <section className="card">
              <div className="lbl" style={{ marginBottom: 6 }}>{t('Aktivne')}</div>
              {m.campaigns.map((c, i) => {
                const total = CAMPAIGNS[c.key].days;
                const left = Math.max(0, Math.round((new Date(c.end).getTime() - new Date(game.date).getTime()) / 864e5) + 1);
                return (
                  <div key={i} style={{ padding: '8px 0', borderTop: i ? '1px solid var(--line)' : 0 }}>
                    <div className="row"><span style={{ fontWeight: 700, fontSize: 14 }}>{t(CAMPAIGNS[c.key].label)}</span><span className="muted" style={{ fontSize: 12 }}>{t('še {n} dni', { n: String(left) })}</span></div>
                    <div className="bar" style={{ marginTop: 6 }}><div style={{ width: `${((total - left) / total) * 100}%` }} /></div>
                  </div>
                );
              })}
            </section>
          )}
          {(game.streak ?? 0) <= -3 && <section className="card" style={{ fontSize: 12.5, borderColor: 'color-mix(in srgb, var(--orange) 45%, transparent)', color: '#ffd2b0' }}>{t('Ekipa je v nizu porazov. Kampanje imajo zdaj pol manjši učinek.')}</section>}
          <div className="lbl" style={{ margin: '4px 4px 0' }}>{t('Nova kampanja')} · {t('na računu')} {eur(fin.balance)}</div>
          {(Object.keys(CAMPAIGNS) as CampaignKey[]).map((k) => {
            const c = CAMPAIGNS[k];
            const running = activeCampaign(game, k);
            const locked = (c.req?.loze && m.facilities.loze < c.req.loze) || (c.req?.fans && (game.fans ?? 50) < c.req.fans);
            return (
              <section key={k} className="card row" style={{ gap: 12, opacity: locked ? 0.6 : 1 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontWeight: 700, fontSize: 14 }}>{t(c.label)}</span>
                  <span className="muted" style={{ display: 'block', fontSize: 12, marginTop: 3, lineHeight: 1.4 }}>{t(c.desc)} · {t('{n} dni', { n: String(c.days) })}</span>
                  {locked && <span style={{ display: 'block', fontSize: 11, marginTop: 3, color: 'var(--orange)' }}>{t('Zahteva VIP lože in navdušenje vsaj 70.')}</span>}
                </span>
                {running ? <span className="muted" style={{ fontSize: 12, fontWeight: 700 }}>{t('teče')}</span>
                  : <button className="btn" style={{ height: 44, padding: '0 14px' }} disabled={!!locked} onClick={() => update((g) => act(startCampaign(g, k)))}>{eur(c.cost)}</button>}
              </section>
            );
          })}
        </>
      )}

      {tab === 'sponzorji' && (
        <>
          {m.offers.length > 0 && (
            <section className="card" style={{ borderColor: 'color-mix(in srgb, var(--orange) 50%, transparent)' }}>
              <div className="lbl" style={{ marginBottom: 6, color: 'var(--orange)' }}>{t('Ponudbe')}</div>
              {m.offers.map((o, i) => (
                <div key={i} style={{ padding: '8px 0', borderTop: i ? '1px solid var(--line)' : 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{o.sponsor} · {t(SLOTS[o.slot].label)}</div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{eur(o.monthly)}{t('/mes')} · {o.years === 1 ? t('ena sezona') : t('dve sezoni')} · {t('vrednost')} {eur(slotValue(game, o.slot))} · {t('velja do')} {fmtDate(o.expires)}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button className="btn" style={{ flex: 1 }} onClick={() => update((g) => act(answerOffer(g, i, true)))}>{t('Sprejmi')}</button>
                    <button className="btn sec" style={{ flex: 1 }} onClick={() => update((g) => act(answerOffer(g, i, false)))}>{t('Zavrni')}</button>
                  </div>
                </div>
              ))}
            </section>
          )}
          <section className="card">
            <div className="row"><span style={{ fontWeight: 700, fontSize: 14 }}>{t('Prsi · glavni sponzor')}</span><span style={{ fontWeight: 700 }}>{eur(fin.sponsor.monthly)}</span></div>
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>{fin.sponsor.name}</div>
          </section>
          {(['dres', 'dvorana', 'digital'] as const).map((grp) => (
            <section key={grp} className="card" style={{ padding: '4px 16px' }}>
              <div className="lbl" style={{ padding: '10px 0 4px' }}>{t(grp === 'dres' ? 'Dres' : grp === 'dvorana' ? 'Dvorana' : 'Digitalno')}</div>
              {(Object.keys(SLOTS) as SlotKey[]).filter((k) => SLOTS[k].group === grp).map((k) => {
                const s = m.slots[k];
                const pending = m.searching[k] || m.offers.some((o) => o.slot === k);
                return (
                  <div key={k} className="row" style={{ padding: '10px 0', borderTop: '1px solid var(--line)', gap: 10 }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 600 }}>{t(SLOTS[k].label)}</span>
                      <span style={{ display: 'block', fontSize: 11.5, marginTop: 2, color: s ? 'var(--muted)' : 'var(--orange)' }}>
                        {s ? `${s.sponsor} · ${t('do')} ${s.until}` : pending ? t('iskanje poteka') : `${t('prosto')} · ${t('vrednost')} ${eur(slotValue(game, k))}`}
                      </span>
                    </span>
                    {s ? <b style={{ fontSize: 13 }}>{eur(s.monthly)}</b>
                      : <button className="btn sec" style={{ height: 40, padding: '0 12px' }} disabled={!!pending} onClick={() => update((g) => act(searchSponsor(g, k)))}>{t('Poišči')}</button>}
                  </div>
                );
              })}
            </section>
          ))}
          <p className="muted" style={{ fontSize: 12, margin: 0 }}>{t('Vrednost mest raste z navdušenjem navijačev in TV prenosi. Pogodbe potečejo 1. julija.')}</p>
        </>
      )}

      {tab === 'dvorana' && (
        <>
          <section className="card">
            <div className="row"><span style={{ fontSize: 16, fontWeight: 800 }}>{club.arena.name}</span><span className="muted" style={{ fontSize: 12 }}>{club.arena.city}</span></div>
            <div className="tiles" style={{ marginTop: 10 }}>
              <Tile v={String(club.arena.capacity)} k={t('sedežev')} />
              <Tile v={String(Math.round(m.seasonSold))} k={t('sezonskih kart')} />
              <Tile v={eur(m.merch)} k={t('trgovina/mes')} />
            </div>
            <button className="btn sec block" style={{ marginTop: 12 }} onClick={() => update((g) => act(requestArena(g, 200)))}>{t('Širitev +200 mest')} · {eur(200 * 450)}</button>
          </section>
          {(Object.keys(FACILITIES) as FacilityKey[]).map((k) => {
            const lv = m.facilities[k];
            const b = m.builds.find((x) => x.key === k);
            return (
              <section key={k} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', borderColor: b ? 'color-mix(in srgb, var(--orange) 45%, transparent)' : undefined }}>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span className="row"><span style={{ fontWeight: 700, fontSize: 14 }}>{t(FACILITIES[k].label)}</span><span style={{ fontSize: 12, color: b ? 'var(--orange)' : 'var(--muted)', fontWeight: 700 }}>{b ? `${t('gradnja do')} ${fmtDate(b.finish)}` : `${lv}/3`}</span></span>
                  <Levels n={lv} building={!!b} />
                  <span className="muted" style={{ fontSize: 12 }}>{lv < 3 ? t(FACILITIES[k].desc(lv)) : t('Najvišja stopnja.')}</span>
                </span>
                {lv < 3 && !b && <button className="btn" style={{ height: 44, padding: '0 12px' }} onClick={() => update((g) => act(buildFacility(g, k)))}>{eur(FACILITIES[k].cost(lv))}</button>}
              </section>
            );
          })}
          <Link href="/klub" className="card row" style={{ color: 'inherit' }}>
            <span style={{ fontSize: 13 }}>{t('Trening center, akademija in drugi objekti so v Klubu.')}</span><span style={{ opacity: 0.6 }}>›</span>
          </Link>
        </>
      )}
    </div>
  );
}

export default function MarketingPage() {
  return (
    <Shell>
      <Suspense fallback={null}>
        <Marketing />
      </Suspense>
    </Shell>
  );
}
