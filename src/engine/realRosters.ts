// Pravi igralci (zasebni preizkus). Vir: javni seznam igralcev 2025/26.
// Atributi niso javni podatek – igra jih oceni iz starosti in moči kluba.
export interface RealPlayer {
  num: number;
  first: string;
  last: string;
  pos: 'G' | 'D' | 'F';
  birth: number;
  shoots?: 'L' | 'D';
  nat?: string;
}

export const REAL_ROSTERS: Record<string, RealPlayer[]> = {
  tri: [
    { num: 20, first: 'Erik', last: 'Čuznar', pos: 'G', birth: 2007, shoots: 'L' },
    { num: 88, first: 'Urban', last: 'Hafner', pos: 'G', birth: 2004, shoots: 'L' },
    { num: 32, first: 'Jure', last: 'Klemenc', pos: 'G', birth: 2007, shoots: 'L' },
    { num: 43, first: 'Miha', last: 'Ahačič', pos: 'D', birth: 1989, shoots: 'L' },
    { num: 22, first: 'Žiga', last: 'Arh', pos: 'D', birth: 2004 },
    { num: 98, first: 'Tanej', last: 'Miklič', pos: 'D', birth: 2003, shoots: 'L' },
    { num: 81, first: 'Aljoša', last: 'Pretnar', pos: 'D', birth: 2002, shoots: 'L' },
    { num: 8, first: 'Jaka', last: 'Rakovič', pos: 'D', birth: 2008, shoots: 'L' },
    { num: 96, first: 'Gašper', last: 'Šmid', pos: 'D', birth: 2004, shoots: 'L' },
    { num: 23, first: 'Žan', last: 'Srpčič', pos: 'D', birth: 1996, shoots: 'L' },
    { num: 17, first: 'Tim', last: 'Veternik', pos: 'D', birth: 2005 },
    { num: 14, first: 'Martin', last: 'Vogrinc', pos: 'D', birth: 2006 },
    { num: 44, first: 'Žan', last: 'Zorman', pos: 'D', birth: 2005, shoots: 'L' },
    { num: 13, first: 'Gaber', last: 'Zupan Škrlj', pos: 'D', birth: 2007, shoots: 'L' },
    { num: 18, first: 'Maj', last: 'Bertoncelj', pos: 'F', birth: 2005 },
    { num: 91, first: 'Nejc', last: 'Burgar', pos: 'F', birth: 2003, shoots: 'L' },
    { num: 97, first: 'Juš', last: 'Dobravec', pos: 'F', birth: 2003, shoots: 'L' },
    { num: 51, first: 'Anže', last: 'Gradišar', pos: 'F', birth: 2008, shoots: 'L' },
    { num: 44, first: 'Mark', last: 'Gradišar', pos: 'F', birth: 2006 },
    { num: 61, first: 'Martin', last: 'Jazbec', pos: 'F', birth: 2003 },
    { num: 5, first: 'Matevž', last: 'Jošt', pos: 'F', birth: 2007, shoots: 'L' },
    { num: 93, first: 'Luka', last: 'Kuhar', pos: 'F', birth: 2005, shoots: 'L' },
    { num: 15, first: 'Matej', last: 'Kuhar', pos: 'F', birth: 2006 },
    { num: 21, first: 'Oskar', last: 'Kuralt', pos: 'F', birth: 2006, shoots: 'L' },
    { num: 39, first: 'Mark', last: 'Lozar', pos: 'F', birth: 2007 },
    { num: 96, first: 'Grega', last: 'Pazlar', pos: 'F', birth: 2004, shoots: 'L' },
    { num: 18, first: 'Martin', last: 'Sodnik', pos: 'F', birth: 2008, shoots: 'L' },
    { num: 16, first: 'Luka', last: 'Zorn', pos: 'F', birth: 2005 },
  ],
};
