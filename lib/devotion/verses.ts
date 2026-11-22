/**
 * Built-in verse of the day (King James Version, public domain). One a day, in order, repeating.
 * Tech Admins can choose a different verse for any day (Admin → Daily verse).
 */
export type Verse = { reference: string; text: string; translation: string }

const KJV: [string, string][] = [
  ['John 3:16', 'For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life.'],
  ['Psalm 23:1', 'The LORD is my shepherd; I shall not want.'],
  ['Philippians 4:13', 'I can do all things through Christ which strengtheneth me.'],
  ['Proverbs 3:5-6', 'Trust in the LORD with all thine heart; and lean not unto thine own understanding. In all thy ways acknowledge him, and he shall direct thy paths.'],
  ['Isaiah 40:31', 'But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint.'],
  ['Romans 8:28', 'And we know that all things work together for good to them that love God, to them who are the called according to his purpose.'],
  ['Jeremiah 29:11', 'For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end.'],
  ['Joshua 1:9', 'Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest.'],
  ['Matthew 6:33', 'But seek ye first the kingdom of God, and his righteousness; and all these things shall be added unto you.'],
  ['Psalm 46:1', 'God is our refuge and strength, a very present help in trouble.'],
  ['Philippians 4:6', 'Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God.'],
  ['Matthew 11:28', 'Come unto me, all ye that labour and are heavy laden, and I will give you rest.'],
  ['Psalm 119:105', 'Thy word is a lamp unto my feet, and a light unto my path.'],
  ['2 Timothy 1:7', 'For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.'],
  ['Romans 12:2', 'And be not conformed to this world: but be ye transformed by the renewing of your mind, that ye may prove what is that good, and acceptable, and perfect, will of God.'],
  ['Isaiah 41:10', 'Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness.'],
  ['Psalm 37:4', 'Delight thyself also in the LORD; and he shall give thee the desires of thine heart.'],
  ['Galatians 5:22-23', 'But the fruit of the Spirit is love, joy, peace, longsuffering, gentleness, goodness, faith, meekness, temperance: against such there is no law.'],
  ['Hebrews 11:1', 'Now faith is the substance of things hoped for, the evidence of things not seen.'],
  ['1 John 1:9', 'If we confess our sins, he is faithful and just to forgive us our sins, and to cleanse us from all unrighteousness.'],
  ['Psalm 121:1-2', 'I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the LORD, which made heaven and earth.'],
  ['Matthew 5:16', 'Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven.'],
  ['Romans 10:9', 'That if thou shalt confess with thy mouth the Lord Jesus, and shalt believe in thine heart that God hath raised him from the dead, thou shalt be saved.'],
  ['Ephesians 2:8', 'For by grace are ye saved through faith; and that not of yourselves: it is the gift of God.'],
  ['John 14:6', 'Jesus saith unto him, I am the way, the truth, and the life: no man cometh unto the Father, but by me.'],
  ['Psalm 27:1', 'The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?'],
  ['Lamentations 3:22-23', "It is of the LORD's mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness."],
  ['1 Peter 5:7', 'Casting all your care upon him; for he careth for you.'],
  ['Proverbs 22:6', 'Train up a child in the way he should go: and when he is old, he will not depart from it.'],
  ['Psalm 34:8', 'O taste and see that the LORD is good: blessed is the man that trusteth in him.'],
  ['John 14:27', 'Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.'],
  ['Matthew 28:19', 'Go ye therefore, and teach all nations, baptizing them in the name of the Father, and of the Son, and of the Holy Ghost.'],
  ['Romans 15:13', 'Now the God of hope fill you with all joy and peace in believing, that ye may abound in hope, through the power of the Holy Ghost.'],
  ['Psalm 91:1', 'He that dwelleth in the secret place of the most High shall abide under the shadow of the Almighty.'],
  ['Isaiah 26:3', 'Thou wilt keep him in perfect peace, whose mind is stayed on thee: because he trusteth in thee.'],
  ['James 1:5', 'If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him.'],
  ['1 Corinthians 13:4', 'Charity suffereth long, and is kind; charity envieth not; charity vaunteth not itself, is not puffed up.'],
  ['Psalm 100:4', 'Enter into his gates with thanksgiving, and into his courts with praise: be thankful unto him, and bless his name.'],
  ['Micah 6:8', 'He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?'],
  ['John 15:5', 'I am the vine, ye are the branches: He that abideth in me, and I in him, the same bringeth forth much fruit: for without me ye can do nothing.'],
  ['2 Corinthians 5:17', 'Therefore if any man be in Christ, he is a new creature: old things are passed away; behold, all things are become new.'],
  ['Psalm 118:24', 'This is the day which the LORD hath made; we will rejoice and be glad in it.'],
  ['Deuteronomy 31:6', 'Be strong and of a good courage, fear not, nor be afraid of them: for the LORD thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee.'],
  ['Hebrews 13:8', 'Jesus Christ the same yesterday, and to day, and for ever.'],
  ['Matthew 7:7', 'Ask, and it shall be given you; seek, and ye shall find; knock, and it shall be opened unto you.'],
  ['Psalm 51:10', 'Create in me a clean heart, O God; and renew a right spirit within me.'],
  ['Romans 5:8', 'But God commendeth his love toward us, in that, while we were yet sinners, Christ died for us.'],
  ['1 Thessalonians 5:16-18', 'Rejoice evermore. Pray without ceasing. In every thing give thanks: for this is the will of God in Christ Jesus concerning you.'],
  ['Proverbs 16:3', 'Commit thy works unto the LORD, and thy thoughts shall be established.'],
  ['Isaiah 9:6', 'For unto us a child is born, unto us a son is given: and the government shall be upon his shoulder: and his name shall be called Wonderful, Counsellor, The mighty God, The everlasting Father, The Prince of Peace.'],
  ['Psalm 139:14', 'I will praise thee; for I am fearfully and wonderfully made: marvellous are thy works; and that my soul knoweth right well.'],
  ['Colossians 3:23', 'And whatsoever ye do, do it heartily, as to the Lord, and not unto men.'],
  ['Nahum 1:7', 'The LORD is good, a strong hold in the day of trouble; and he knoweth them that trust in him.'],
  ['John 8:32', 'And ye shall know the truth, and the truth shall make you free.'],
  ['Psalm 55:22', 'Cast thy burden upon the LORD, and he shall sustain thee: he shall never suffer the righteous to be moved.'],
  ['Galatians 6:9', 'And let us not be weary in well doing: for in due season we shall reap, if we faint not.'],
  ['Zephaniah 3:17', 'The LORD thy God in the midst of thee is mighty; he will save, he will rejoice over thee with joy; he will rest in his love, he will joy over thee with singing.'],
  ['Mark 11:24', 'Therefore I say unto you, What things soever ye desire, when ye pray, believe that ye receive them, and ye shall have them.'],
  ['Psalm 103:2', 'Bless the LORD, O my soul, and forget not all his benefits.'],
  ['Ephesians 6:10', 'Finally, my brethren, be strong in the Lord, and in the power of his might.'],
]

export const BUILT_IN: Verse[] = KJV.map(([reference, text]) => ({ reference, text, translation: 'KJV' }))

/** Day number in Ghana (UTC) for "YYYY-MM-DD". */
const dayNumber = (day: string) => Math.floor(Date.parse(`${day}T00:00:00Z`) / 864e5)

export function builtInVerse(day: string): Verse {
  return BUILT_IN[((dayNumber(day) % BUILT_IN.length) + BUILT_IN.length) % BUILT_IN.length]
}

/** Today's date in Ghana as "YYYY-MM-DD". */
export const today = (now = new Date()) => now.toISOString().slice(0, 10)
