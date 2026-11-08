// Pravi igralci (zasebni preizkus). Vir: javni seznam igralcev 2026/27, ocene iz statistike IHL 2025/26.
// Atributi niso javni podatek – igra jih oceni iz starosti in moči kluba.
export interface RealPlayer {
  num: number; // 0 = neznana številka
  first: string;
  last: string;
  pos: 'G' | 'D' | 'F' | 'C' | 'LW' | 'RW';
  birth: number;
  shoots?: 'L' | 'D';
  nat?: string;
  boost?: number; // prilagoditev ocene glede na lansko statistiko
  captain?: 'C' | 'A';
}

export const REAL_ROSTERS: Record<string, RealPlayer[]> = {
  tri: [
    { num: 37, first: 'Erik', last: 'Cuznar', pos: 'G', birth: 2007, shoots: 'L' },
    { num: 19, first: 'Urban', last: 'Hafner', pos: 'G', birth: 2004, shoots: 'L', boost: 6 },
    { num: 0, first: 'Jure', last: 'Klemenc', pos: 'G', birth: 2007, shoots: 'L' },
    { num: 43, first: 'Miha', last: 'Ahačič', pos: 'D', birth: 1989, shoots: 'L', boost: 6, captain: 'C' },
    { num: 6, first: 'Žiga', last: 'Arh', pos: 'D', birth: 2004 },
    { num: 24, first: 'Tim', last: 'Dolinar', pos: 'D', birth: 2003 },
    { num: 68, first: 'Tanej', last: 'Miklič', pos: 'D', birth: 2003, shoots: 'L', boost: -2 },
    { num: 81, first: 'Aljoša', last: 'Pretnar', pos: 'D', birth: 2002, shoots: 'L', boost: 8, captain: 'A' },
    { num: 23, first: 'Žan', last: 'Srpčič', pos: 'D', birth: 1996, shoots: 'L', boost: -3 },
    { num: 17, first: 'Tim', last: 'Veternik', pos: 'D', birth: 2005, boost: 3 },
    { num: 14, first: 'Martin', last: 'Vogrinc', pos: 'D', birth: 2006 },
    { num: 44, first: 'Žan', last: 'Zorman', pos: 'D', birth: 2005, shoots: 'L' },
    { num: 13, first: 'Gaber', last: 'Zupan Škrlj', pos: 'D', birth: 2007, shoots: 'L', boost: 0 },
    { num: 18, first: 'Maj', last: 'Bertoncelj', pos: 'F', birth: 2005, boost: 3 },
    { num: 11, first: 'Juš', last: 'Dobravec', pos: 'F', birth: 2003, shoots: 'L', boost: 5 },
    { num: 51, first: 'Maks', last: 'Gaser', pos: 'F', birth: 2009 },
    { num: 9, first: 'Matevž', last: 'Jošt', pos: 'F', birth: 2007, shoots: 'L', boost: -1 },
    { num: 52, first: 'Matej', last: 'Kordež', pos: 'F', birth: 2009 },
    { num: 93, first: 'Luka', last: 'Kuhar', pos: 'F', birth: 2005, shoots: 'L', boost: -2 },
    { num: 86, first: 'Matej', last: 'Kuhar', pos: 'F', birth: 2006, boost: -3 },
    { num: 16, first: 'Oskar', last: 'Kuralt', pos: 'F', birth: 2006, shoots: 'L', boost: 1 },
    { num: 78, first: 'Mark', last: 'Lozar', pos: 'F', birth: 2007, boost: 0 },
    { num: 42, first: 'Rožle', last: 'Lužan', pos: 'F', birth: 2009 },
    { num: 0, first: 'Rok', last: 'Naglič Orehar', pos: 'F', birth: 2007 },
    { num: 21, first: 'Grega', last: 'Pazlar', pos: 'F', birth: 2004, shoots: 'L', boost: 8 },
    { num: 7, first: 'Jaka', last: 'Perić', pos: 'F', birth: 2009 },
    { num: 91, first: 'Jaka', last: 'Strehovec', pos: 'C', birth: 2008 },
    { num: 3, first: 'Andraž', last: 'Thaler', pos: 'F', birth: 2007 },
    { num: 8, first: 'Urban', last: 'Tratnik', pos: 'F', birth: 2009 },
    { num: 56, first: 'Luka', last: 'Zorn', pos: 'F', birth: 2005, boost: -3 },
  ],
};
