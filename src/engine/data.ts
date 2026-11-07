import type { Club } from './types';

// Klubi IHL v1. Kapacitete: EliteProspects (nekatere je treba potrditi pri klubih).
// strength = izhodiščna moč kadra za generirane igralce (dokler ni prave baze).
export const CLUBS: (Club & { strength: number })[] = [
  { id: 'tri', name: 'HK Triglav Kranj', short: 'Triglav', city: 'Kranj', country: 'SLO', color: '#2E7DD7', arena: { name: 'Zlato polje', city: 'Kranj', capacity: 800 }, reputation: 62, budget: 4, boardGoal: 'naslov', strength: 58 },
  { id: 'czv', name: 'SKHL Crvena zvezda', short: 'C. zvezda', city: 'Beograd', country: 'SRB', color: '#D7263D', arena: { name: 'Pionir', city: 'Beograd', capacity: 2000 }, reputation: 62, budget: 4, boardGoal: 'naslov', strength: 57.5 },
  { id: 'med', name: 'KHL Medveščak', short: 'Medveščak', city: 'Zagreb', country: 'HR', color: '#1F4FA8', arena: { name: 'Admiral Ice Dome', city: 'Zagreb', capacity: 850 }, reputation: 60, budget: 4, boardGoal: 'finale', strength: 56.5 },
  { id: 'sla', name: 'HK Slavija Junior', short: 'Slavija Jr.', city: 'Ljubljana', country: 'SLO', color: '#F2C14E', arena: { name: 'Zalog', city: 'Ljubljana', capacity: 1200 }, reputation: 55, budget: 2, boardGoal: 'polfinale', strength: 55 },
  { id: 'par', name: 'HK Partizan', short: 'Partizan', city: 'Beograd', country: 'SRB', color: '#9AA3AE', arena: { name: 'Pionir', city: 'Beograd', capacity: 2000 }, reputation: 54, budget: 3, boardGoal: 'polfinale', strength: 54 },
  { id: 'cel', name: 'HK Ledx Celje', short: 'Celje', city: 'Celje', country: 'SLO', color: '#E8B923', arena: { name: 'Celje Ice Hall', city: 'Celje', capacity: 1500 }, reputation: 52, budget: 2, boardGoal: 'končnica', strength: 53 },
  { id: 'zag', name: 'KHL Zagreb', short: 'Zagreb', city: 'Zagreb', country: 'HR', color: '#3A7D44', arena: { name: 'Velesajam', city: 'Zagreb', capacity: 500 }, reputation: 50, budget: 3, boardGoal: 'končnica', strength: 52.5 },
  { id: 'mla', name: 'KHL Mladost', short: 'Mladost', city: 'Zagreb', country: 'HR', color: '#5BA4E6', arena: { name: 'Velesajam', city: 'Zagreb', capacity: 500 }, reputation: 48, budget: 2, boardGoal: 'končnica', strength: 51.5 },
  { id: 'ips', name: 'IH Pro Stars', short: 'Pro Stars', city: 'Novi Sad', country: 'SRB', color: '#8E5BD6', arena: { name: 'SPENS', city: 'Novi Sad', capacity: 1283 }, reputation: 45, budget: 2, boardGoal: 'končnica', strength: 50.5 },
];

export const NAMES: Record<'SLO' | 'HR' | 'SRB', { first: string[]; last: string[] }> = {
  SLO: {
    first: ['Luka', 'Jan', 'Žan', 'Nejc', 'Matic', 'Rok', 'Gal', 'Tim', 'Jaka', 'Miha', 'Aljaž', 'Urban', 'Blaž', 'Lan', 'Enej', 'Anže', 'Nik', 'Jakob', 'Tilen', 'Vid', 'Maks', 'Jure', 'Žiga', 'Domen', 'Gašper', 'Tadej', 'Klemen', 'Matevž', 'Bor', 'Val'],
    last: ['Ferjan', 'Kovač', 'Robič', 'Pintar', 'Zupan', 'Bergant', 'Jerič', 'Kern', 'Mohorič', 'Šuštar', 'Lešnik', 'Krmelj', 'Debeljak', 'Golob', 'Trojar', 'Rozman', 'Sitar', 'Hribar', 'Lavtar', 'Šifrer', 'Bizjak', 'Kavčič', 'Zorman', 'Logar', 'Rupnik', 'Oblak', 'Podgornik', 'Jenko', 'Kos', 'Mrak', 'Vidic', 'Kralj', 'Erjavec', 'Pečnik', 'Frelih'],
  },
  HR: {
    first: ['Ivan', 'Luka', 'Marko', 'Josip', 'Filip', 'Ante', 'Matej', 'Karlo', 'Dino', 'Petar', 'Fran', 'Tin', 'Borna', 'Lovro', 'Toni', 'Mateo', 'Leon', 'Roko', 'Niko', 'Domagoj'],
    last: ['Horvat', 'Kovačević', 'Babić', 'Marić', 'Jurić', 'Novak', 'Knežević', 'Vuković', 'Perić', 'Pavlović', 'Matić', 'Tomić', 'Šarić', 'Lovrić', 'Grgić', 'Radić', 'Bošnjak', 'Brkić', 'Vidović', 'Kolar'],
  },
  SRB: {
    first: ['Stefan', 'Nikola', 'Marko', 'Lazar', 'Uroš', 'Miloš', 'Luka', 'Aleksa', 'Nemanja', 'Filip', 'Vuk', 'Andrija', 'Dušan', 'Đorđe', 'Ognjen', 'Strahinja', 'Petar', 'Vukašin', 'Bogdan', 'Mihajlo'],
    last: ['Ilić', 'Petrović', 'Jovanović', 'Nikolić', 'Marković', 'Đorđević', 'Stojanović', 'Popović', 'Simić', 'Kostić', 'Lazić', 'Mitrović', 'Pavlović', 'Ristić', 'Milošević', 'Vasić', 'Todorović', 'Savić', 'Obradović', 'Stanković'],
  },
};

export const IMPORT_NAMES = {
  first: ['Ryan', 'Tyler', 'Mikko', 'Juuso', 'Ondřej', 'Tomáš', 'Jesse', 'Erik', 'Brady', 'Patrik'],
  last: ['Kowalski', 'Mäkinen', 'Novotný', 'Lindqvist', 'Hartley', 'Korhonen', 'Svoboda', 'Bennett', 'Dvořák', 'Holmberg'],
  nats: ['CAN', 'FIN', 'CZE', 'SWE', 'USA', 'SVK'],
};
