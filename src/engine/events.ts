import { careerTotals, ensureV2 } from './club';
import { newId } from './players';
import { Rng, clamp } from './rng';
import type { Decision, Fixture, GameState, Player } from './types';

const name = (p: Player) => `${p.first} ${p.last}`;
const roster = (s: GameState) => Object.values(s.players).filter((p) => p.clubId === s.userClubId);
const clubShort = (s: GameState, id: string) => s.clubs.find((c) => c.id === id)!.short;
const moraleAll = (s: GameState, d: number, filter?: (p: Player) => boolean) => roster(s).filter((p) => !filter || filter(p)).forEach((p) => (p.morale = clamp(p.morale + d, 5, 100)));
const addFans = (s: GameState, d: number) => (s.fans = clamp((s.fans ?? 50) + d, 0, 100));
const addBoard = (s: GameState, d: number) => (s.board = clamp((s.board ?? 55) + d, 0, 100));

function push(state: GameState, d: Omit<Decision, 'id' | 'date'>) {
  ensureV2(state);
  state.decisions!.push({ id: newId('d'), date: state.date, ...d });
}

export const hasBlocking = (s: GameState) => (s.decisions ?? []).some((d) => d.blocking);

function news(state: GameState, kind: 'garderoba' | 'mediji' | 'uprava' | 'klub', title: string, body: string) {
  state.news.unshift({ id: newId('n'), date: state.date, title, body, kind, read: false });
  if (state.news.length > 80) state.news.length = 80;
}

// --- po vsaki tekmi tvojega kluba ---
export function afterUserMatch(state: GameState, f: Fixture) {
  ensureV2(state);
  const r = f.result!;
  const us = f.home === state.userClubId;
  const my = us ? r.hg : r.ag;
  const op = us ? r.ag : r.hg;
  const won = my > op;
  const oppId = us ? f.away : f.home;
  const derby = [['czv', 'par'], ['med', 'zag', 'mla'], ['tri', 'sla', 'cel']].some((g) => g.includes(f.home) && g.includes(f.away));

  state.decisions = (state.decisions ?? []).filter((d) => !(d.kind === 'konferenca' && d.fixtureId === f.id));
  // niz in navijači
  state.streak = won ? Math.max(0, state.streak ?? 0) + 1 : Math.min(0, state.streak ?? 0) - 1;
  addFans(state, (won ? 1 : -1) * (derby ? 2 : 1) + (won && my - op >= 4 ? 1 : 0));
  const ms = state.managerStats!;
  ms.gp++;
  if (won) ms.w++;
  else ms.l++;

  // izjava pred tekmo
  if (state.pressMood?.fixtureId === f.id) {
    if (state.pressMood.mood === 'confident') {
      addFans(state, won ? 2 : -4);
      if (!won) news(state, 'mediji', 'Mediji o napovedi trenerja', `Pred tekmo ste napovedali zmago, a ${clubShort(state, state.userClubId)} je izgubil ${my}:${op}. Navijači niso navdušeni.`);
    }
    state.pressMood = undefined;
  }

  // klopca: kdo ni igral ali je igral v 4. napadu
  const lines = state.lines[state.userClubId];
  const dressed = new Set((r.box ?? []).map((b) => b[0]));
  const fourth = new Set(lines.f[3]);
  for (const p of roster(state)) {
    if (p.injuryDays > 0) continue;
    if (!dressed.has(p.id) || fourth.has(p.id)) p.benchStreak = (p.benchStreak ?? 0) + 1;
    else p.benchStreak = 0;
  }

  // medijske zgodbe
  const cl = clubShort(state, state.userClubId);
  if (won && my - op >= 5) news(state, 'mediji', `Visoka zmaga: ${cl} ${my}:${op}`, `${cl} je razbil ${clubShort(state, oppId)}. Mediji pišejo o eni najprepričljivejših predstav sezone.`);
  if (state.streak === 5) news(state, 'mediji', 'Pet zmag zapored', `${cl} je v izjemni formi. Navijači sanjajo o naslovu.`);
  if (state.streak === -4) news(state, 'mediji', 'Kriza v klubu?', `${cl} je izgubil štiri tekme zapored. Mediji se sprašujejo o prihodnosti trenerja.`);
  const goalsBy: Record<string, number> = {};
  r.goals.forEach((g) => (goalsBy[g.scorer] = (goalsBy[g.scorer] ?? 0) + 1));
  for (const [pid, g] of Object.entries(goalsBy)) {
    const p = state.players[pid];
    if (!p) continue;
    if (g >= 3) news(state, 'mediji', `Hat-trick: ${name(p)}`, `${name(p)} (${clubShort(state, p.clubId!)}) je dosegel ${g} gole na tekmi.`);
    if (p.clubId === state.userClubId) {
      const tot = careerTotals(p);
      const age = state.seasonYear - p.birthYear;
      if (tot.g === g && age <= 20) news(state, 'mediji', `Prvi gol za ${name(p)}`, `${age}-letni ${name(p)} je dosegel svoj prvi gol v članski konkurenci.`);
      for (const m of [50, 100, 150, 200]) if (tot.g >= m && tot.g - g < m) news(state, 'mediji', `${m}. gol: ${name(p)}`, `${name(p)} je dosegel ${m}. gol v karieri.`);
    }
  }
  for (const pid of dressed) {
    const p = state.players[pid];
    if (!p || p.clubId !== state.userClubId) continue;
    const tot = careerTotals(p);
    if ([100, 200, 300, 400, 500].includes(tot.gp)) news(state, 'mediji', `${tot.gp}. nastop: ${name(p)}`, `${name(p)} je odigral ${tot.gp}. tekmo v karieri.`);
  }
  const myGoalie = r.goalies?.[us ? 'home' : 'away'];
  if (op === 0 && myGoalie && state.players[myGoalie]) news(state, 'mediji', `Ničla: ${name(state.players[myGoalie])}`, `Golman ${name(state.players[myGoalie])} je ohranil mrežo nedotaknjeno.`);

  // rekord kluba
  const cr = state.clubRecords![state.userClubId];
  if (won && (!cr.biggestWin || my - op > cr.biggestWin.diff)) cr.biggestWin = { score: `${my}:${op}`, vs: oppId, season: `${state.seasonYear}/${String(state.seasonYear + 1).slice(2)}`, diff: my - op };

  // konferenca po tekmi
  if (!state.pressDone!.includes(f.id + ':po')) {
    state.pressDone!.push(f.id + ':po');
    const best = (r.box ?? []).filter((b) => (us ? b[1] === 0 : b[1] === 1)).sort((a, b) => b[2] * 2 + b[3] - (a[2] * 2 + a[3]))[0];
    const bestP = best ? state.players[best[0]] : undefined;
    if (won) {
      push(state, {
        kind: 'konferenca', blocking: false, fixtureId: f.id, playerId: bestP?.id, expires: addDay(state.date, 1),
        title: 'Novinarska konferenca po tekmi',
        body: `Zmaga ${my}:${op} proti ${clubShort(state, oppId)}. Kaj je bilo odločilno?`,
        options: [
          { label: 'Pohvala celotni ekipi.', effect: 'post_win_team' },
          ...(bestP ? [{ label: `Izpostavil bi ${name(bestP)}.`, effect: 'post_win_star' }] : []),
          { label: 'Še vedno imamo veliko dela.', effect: 'post_win_humble' },
        ],
      });
    } else {
      push(state, {
        kind: 'konferenca', blocking: false, fixtureId: f.id, expires: addDay(state.date, 1),
        title: 'Novinarska konferenca po tekmi',
        body: `Poraz ${my}:${op} proti ${clubShort(state, oppId)}. Kaj je šlo narobe?`,
        options: [
          { label: 'Prevzemam odgovornost.', effect: 'post_loss_me' },
          { label: 'Igralci niso dali vsega od sebe.', effect: 'post_loss_players' },
          { label: 'Sodniki so odločili tekmo.', effect: 'post_loss_refs' },
        ],
      });
    }
  }
}

// --- konferenca pred tekmo (na dan tekme) ---
export function preMatchPress(state: GameState, f: Fixture, standingPos: (id: string) => number) {
  ensureV2(state);
  if (state.pressDone!.includes(f.id + ':pred')) return;
  state.pressDone!.push(f.id + ':pred');
  if (state.pressDone!.length > 200) state.pressDone = state.pressDone!.slice(-100);
  const oppId = f.home === state.userClubId ? f.away : f.home;
  const opp = clubShort(state, oppId);
  const derby = [['czv', 'par'], ['med', 'zag', 'mla'], ['tri', 'sla', 'cel']].some((g) => g.includes(f.home) && g.includes(f.away));
  const streak = state.streak ?? 0;
  let body: string;
  if (f.stage !== 'redni') body = `Končnica proti ${opp}. Ste pripravljeni na serijo?`;
  else if (derby) body = `Danes je derbi proti ${opp}. Kakšna so pričakovanja?`;
  else if (streak <= -3) body = `Izgubili ste ${-streak} tekme zapored. Je vaš položaj ogrožen?`;
  else if (streak >= 3) body = `Niz ${streak} zmag. Ste zdaj favoriti za naslov?`;
  else if (standingPos(oppId) < standingPos(state.userClubId)) body = `${opp} je na lestvici višje. Kako se boste postavili nasproti njim?`;
  else body = `Kako ocenjujete današnjega nasprotnika ${opp}?`;
  push(state, {
    kind: 'konferenca', blocking: false, fixtureId: f.id, expires: state.date,
    title: 'Novinarska konferenca pred tekmo',
    body,
    options: [
      { label: streak <= -3 ? 'Verjamem v ekipo, obrat prihaja.' : 'Zmagali bomo, o tem ni dvoma.', effect: 'pre_confident' },
      { label: streak <= -3 ? 'Igralci morajo prevzeti odgovornost.' : 'Spoštujemo nasprotnika, a smo pripravljeni.', effect: streak <= -3 ? 'pre_demand' : 'pre_respect' },
      { label: 'Za nas je to tekma kot vsaka druga.', effect: 'pre_neutral' },
    ],
  });
}

// --- dogodki v slačilnici (enkrat na teden) ---
export function weeklyLocker(state: GameState, pos: number) {
  ensureV2(state);
  if (hasBlocking(state)) return;
  const rng = new Rng(state.seed++);
  if (!rng.chance(0.45)) return;
  const team = roster(state).filter((p) => p.injuryDays <= 0);
  const avg = team.reduce((s, p) => s + p.ovr, 0) / Math.max(1, team.length);
  const promised = new Set(state.promises!.map((p) => p.playerId));

  const benched = team.filter((p) => (p.benchStreak ?? 0) >= 5 && !promised.has(p.id) && (p.personality === 'individualist' || p.personality === 'ambiciozen' || p.ovr >= avg)).sort((a, b) => b.ovr - a.ovr)[0];
  if (benched) {
    push(state, {
      kind: 'garderoba', blocking: true, playerId: benched.id,
      title: `Nezadovoljstvo: ${name(benched)}`,
      body: `${name(benched)} je nezadovoljen, ker zadnjih ${benched.benchStreak} tekem ni igral ali je bil v 4. napadu. Meni, da si zasluži večjo vlogo.`,
      options: [
        { label: 'Obljubi mu večjo vlogo v naslednjih 3 tednih.', effect: 'bench_promise' },
        { label: 'Priložnost si mora prislužiti na treningu.', effect: 'bench_train' },
        { label: 'Postavi ga na seznam za prodajo.', effect: 'bench_list' },
      ],
    });
    return;
  }

  const leader = team.filter((p) => p.personality === 'vodja').sort((a, b) => b.attrs.leadership - a.attrs.leadership)[0] ?? [...team].sort((a, b) => b.attrs.leadership - a.attrs.leadership)[0];
  if ((state.streak ?? 0) <= -3 && leader) {
    push(state, {
      kind: 'garderoba', blocking: true, playerId: leader.id,
      title: 'Sestanek s kapetanom',
      body: `${name(leader)} pravi, da je v slačilnici po ${-(state.streak ?? 0)} porazih zapored slabo vzdušje. Kako boš odreagiral?`,
      options: [
        { label: 'Podpri ekipo in jim vrni samozavest.', effect: 'crisis_support' },
        { label: 'Zahtevaj več truda in discipline.', effect: 'crisis_demand' },
        { label: 'Napovej spremembo taktike.', effect: 'crisis_tactic' },
      ],
    });
    return;
  }

  const hot = team.filter((p) => p.personality === 'temperamenten');
  if (hot.length >= 2 && rng.chance(0.35)) {
    const [a, b] = [hot[0], hot[1]];
    push(state, {
      kind: 'garderoba', blocking: true, playerId: a.id, otherId: b.id,
      title: 'Prepir na treningu',
      body: `${name(a)} in ${name(b)} sta se na treningu sprla, skoraj je prišlo do pretepa. Soigralci čakajo tvoj odziv.`,
      options: [
        { label: 'Kaznuj oba z denarno kaznijo.', effect: 'fight_punish' },
        { label: 'Pogovori se z obema.', effect: 'fight_talk' },
        { label: 'Ignoriraj, to je hokej.', effect: 'fight_ignore' },
      ],
    });
    return;
  }

  const vet = team.find((p) => state.seasonYear - p.birthYear >= 30 && (p.personality === 'vodja' || p.personality === 'profesionalec'));
  const kid = team.find((p) => state.seasonYear - p.birthYear <= 20 && p.potential - p.ovr >= 8 && !p.mentorId);
  if (vet && kid && rng.chance(0.4)) {
    push(state, {
      kind: 'garderoba', blocking: true, playerId: kid.id, otherId: vet.id,
      title: 'Mentorstvo',
      body: `Pomočnik trenerja predlaga, da ${name(vet)} (${state.seasonYear - vet.birthYear} let) prevzame mentorstvo nad mladim ${name(kid)}. To bi lahko pospešilo njegov razvoj.`,
      options: [
        { label: `Določi ${vet.last}a za mentorja.`, effect: 'mentor_yes' },
        { label: 'Ne zdaj.', effect: 'mentor_no' },
      ],
    });
    return;
  }

  const amb = team.find((p) => p.personality === 'ambiciozen' && p.ovr >= avg + 4);
  if (amb && pos >= 5 && rng.chance(0.3)) {
    push(state, {
      kind: 'garderoba', blocking: true, playerId: amb.id,
      title: `${name(amb)} razmišlja o odhodu`,
      body: `${name(amb)} meni, da klub ni dovolj ambiciozen (trenutno ${pos}. mesto). Njegov zastopnik pravi, da razmišlja o odhodu ob koncu sezone.`,
      options: [
        { label: 'Ponudi mu višjo plačo (+20 %).', effect: 'amb_wage' },
        { label: 'Prepričaj ga z vizijo kluba.', effect: 'amb_talk' },
        { label: 'Če želi, lahko odide.', effect: 'amb_let' },
      ],
    });
  }
}

// --- obljube ---
export function checkPromises(state: GameState) {
  ensureV2(state);
  const keep = [];
  for (const pr of state.promises!) {
    const p = state.players[pr.playerId];
    if (!p || p.clubId !== state.userClubId) continue;
    if (state.date < pr.until) {
      keep.push(pr);
      continue;
    }
    if ((p.benchStreak ?? 0) >= 2) {
      p.morale = clamp(p.morale - 22, 5, 100);
      moraleAll(state, -2);
      news(state, 'garderoba', `Prelomljena obljuba: ${name(p)}`, `${name(p)} je razočaran, ker ni dobil obljubljene vloge. Tudi soigralci so opazili.`);
    } else {
      p.morale = clamp(p.morale + 6, 5, 100);
      news(state, 'garderoba', `${name(p)} je zadovoljen`, 'Obljuba o večji vlogi je izpolnjena.');
    }
  }
  state.promises = keep;
}

// --- tedensko: uprava, vodje v slačilnici ---
export function weeklyBoardAndMood(state: GameState, pos: number, goal: string) {
  ensureV2(state);
  const target = goal === 'naslov' ? 1 : goal === 'finale' ? 2 : goal === 'polfinale' ? 4 : 6;
  addBoard(state, clamp((target + 1 - pos) * 0.4, -1.5, 1.2) + ((state.finance[state.userClubId]?.balance ?? 0) < 0 ? -1 : 0.3));
  const team = roster(state);
  const leaders = team.filter((p) => p.personality === 'vodja').length;
  team.forEach((p) => {
    const tgt = 62 + leaders * 3 + (state.fans ?? 50) / 20;
    p.morale = clamp(Math.round(p.morale + (tgt - p.morale) * 0.15), 5, 100);
  });
  if ((state.board ?? 55) < 20) {
    const last = state.news.find((n) => n.kind === 'uprava' && n.title === 'Uprava izgublja potrpljenje');
    if (!last || last.date < addDay(state.date, -28)) news(state, 'uprava', 'Uprava izgublja potrpljenje', `Zaupanje uprave je padlo na ${Math.round(state.board ?? 0)} %. Potrebni so boljši rezultati.`);
  }
}

export function expireDecisions(state: GameState) {
  ensureV2(state);
  state.decisions = state.decisions!.filter((d) => d.blocking || !d.expires || d.expires >= state.date);
}

// --- odločitev ---
export function resolveDecision(state: GameState, id: string, optionIdx: number): string {
  ensureV2(state);
  const d = state.decisions!.find((x) => x.id === id);
  if (!d) return '';
  const opt = d.options[optionIdx];
  state.decisions = state.decisions!.filter((x) => x.id !== id);
  const p = d.playerId ? state.players[d.playerId] : undefined;
  const o = d.otherId ? state.players[d.otherId] : undefined;
  const m = (pl: Player | undefined, v: number) => pl && (pl.morale = clamp(pl.morale + v, 5, 100));
  const isWorker = (pl: Player) => pl.personality === 'profesionalec' || pl.personality === 'delaven';
  switch (opt?.effect) {
    case 'pre_confident':
      moraleAll(state, 3);
      addFans(state, 1);
      state.pressMood = { fixtureId: d.fixtureId!, mood: 'confident' };
      return 'Ekipa je samozavestna. Če zmagate, bodo navijači navdušeni, če izgubite, pa razočarani.';
    case 'pre_respect':
      moraleAll(state, 1);
      addBoard(state, 0.5);
      return 'Umirjen odgovor. Uprava ceni spoštljiv ton.';
    case 'pre_demand':
      moraleAll(state, 3, isWorker);
      moraleAll(state, -3, (pl) => !isWorker(pl));
      addBoard(state, 1);
      return 'Pritisk na igralce. Delavni so motivirani, ostali manj.';
    case 'pre_neutral':
      return 'Brez posebnega odziva.';
    case 'post_win_team':
      moraleAll(state, 2);
      return 'Ekipa ceni pohvalo.';
    case 'post_win_star':
      m(p, 8);
      moraleAll(state, -2, (pl) => pl.personality === 'individualist' && pl.id !== p?.id);
      return p ? `${name(p)} je ponosen. Kakšen individualist je malce ljubosumen.` : '';
    case 'post_win_humble':
      moraleAll(state, 2, isWorker);
      addBoard(state, 1);
      return 'Uprava ceni skromnost, delavni igralci tudi.';
    case 'post_loss_me':
      moraleAll(state, 2);
      addBoard(state, -1);
      return 'Igralci cenijo, da si jih zaščitil. Uprava je nekoliko zaskrbljena.';
    case 'post_loss_players':
      moraleAll(state, -4);
      moraleAll(state, -5, (pl) => pl.personality === 'temperamenten');
      addBoard(state, 1);
      return 'Javna kritika je zabolela slačilnico.';
    case 'post_loss_refs':
      addFans(state, 2);
      addBoard(state, -2);
      return 'Navijači so na tvoji strani, uprava ne mara izgovorov.';
    case 'bench_promise':
      if (p) {
        m(p, 12);
        p.benchStreak = 0;
        state.promises!.push({ playerId: p.id, type: 'vloga', until: addDay(state.date, 21) });
      }
      return p ? `${name(p)} je zadovoljen. Če ga v 3 tednih ne boš postavil v prve tri napade, bo razočaran.` : '';
    case 'bench_train':
      if (p) m(p, isWorker(p) ? 3 : p.personality === 'individualist' ? -12 : -4);
      return p ? (isWorker(p) ? `${name(p)} bo dal vse od sebe na treningu.` : `${name(p)} ni zadovoljen z odgovorom.`) : '';
    case 'bench_list':
      if (p) {
        m(p, -10);
        p.listed = true;
      }
      return p ? `${name(p)} je na seznamu za prodajo.` : '';
    case 'crisis_support':
      moraleAll(state, 5);
      return 'Vzdušje v slačilnici se je izboljšalo.';
    case 'crisis_demand':
      moraleAll(state, 5, isWorker);
      moraleAll(state, -8, (pl) => pl.personality === 'temperamenten');
      moraleAll(state, -1, (pl) => !isWorker(pl) && pl.personality !== 'temperamenten');
      addBoard(state, 1);
      return 'Delavni igralci so sprejeli izziv, temperamentni manj.';
    case 'crisis_tactic':
      moraleAll(state, 1);
      state.tactics[state.userClubId] = { ...state.tactics[state.userClubId], forecheck: 'uravnotezen', tempo: 'normalen' };
      return 'Taktika je nastavljena na uravnoteženo igro.';
    case 'fight_punish':
      m(p, -10);
      m(o, -10);
      moraleAll(state, 2, (pl) => pl.id !== p?.id && pl.id !== o?.id);
      addBoard(state, 1);
      return 'Red v slačilnici. Kaznovana igralca sta jezna.';
    case 'fight_talk':
      m(p, 3);
      m(o, 3);
      return 'Pogovor je pomiril strasti.';
    case 'fight_ignore':
      moraleAll(state, -3);
      return 'Napetost v slačilnici ostaja.';
    case 'mentor_yes':
      if (p && o) {
        p.mentorId = o.id;
        m(p, 4);
        m(o, 4);
      }
      return p && o ? `${name(o)} je mentor mladega ${name(p)}. Učinek se pokaže ob koncu sezone.` : '';
    case 'mentor_no':
      return 'Morda kdaj drugič.';
    case 'amb_wage':
      if (p) {
        p.wage = Math.round((p.wage * 1.2) / 50) * 50;
        m(p, 15);
      }
      return p ? `${name(p)} ostaja motiviran. Nova plača: ${p.wage} €/mes.` : '';
    case 'amb_talk': {
      const ok = new Rng(state.seed++).chance(0.5);
      m(p, ok ? 8 : -8);
      return ok ? 'Prepričal si ga, ostaja zavzet.' : 'Ni ga prepričalo, še vedno razmišlja o odhodu.';
    }
    case 'amb_let':
      if (p) {
        p.listed = true;
        m(p, -5);
      }
      return 'Igralec bo po sezoni verjetno odšel.';
  }
  return '';
}

function addDay(d: string, n: number) {
  const x = new Date(d + 'T12:00:00Z');
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}
