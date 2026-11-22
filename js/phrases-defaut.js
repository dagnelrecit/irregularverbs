/* Banque de phrases par défaut (activités « Phrases à compléter » et « Chasse aux erreurs »).
   Format : "verbe|phrase avec ___|réponse|forme|indice"
   Formes : P = passé simple · PP = participe passé · B = infinitif (base form) · S = présent (he/she/it + s)
   L'indice est le mot ou groupe de mots de la phrase qui révèle le temps (mis en évidence dans la correction).
   L'administrateur peut copier ces phrases dans l'onglet « Phrases » de la feuille Google pour les modifier. */
const PHRASES_DEFAUT = `
be|Yesterday, the math test ___ really hard.|was|P|Yesterday
be|Have you ever ___ to a Canadiens game?|been|PP|Have you ever
be|My little brother ___ always late for the bus.|is|S|always
bear|Last night, the tired goalie ___ the pain until the end of the game.|bore|P|Last night
bear|My grandmother was ___ in Gaspé in 1950.|born|PP|was
bear|She couldn't ___ the noise of the construction anymore.|bear|B|couldn't
beat|Last Saturday, our team ___ the Saguenay team 4 to 2.|beat|P|Last Saturday
beat|Nobody has ever ___ my high score in Tetris.|beaten|PP|has ever
beat|Did your brother ___ you at chess again?|beat|B|Did
become|Two years ago, Emma ___ the captain of the soccer team.|became|P|Two years ago
become|This song has ___ really popular on TikTok.|become|PP|has
become|I want to ___ a video game designer one day.|become|B|want to
begin|The movie ___ at 7 p.m. last night.|began|P|last night
begin|Hurry up! The concert has already ___.|begun|PP|has already
begin|School usually ___ at 8:15.|begins|S|usually
bend|Yesterday, Leo ___ his bike wheel when he hit the curb.|bent|P|Yesterday
bend|Oh no! Someone has ___ my new headphones.|bent|PP|has
bend|Don't ___ the cards, they're collector's items!|bend|B|Don't
bite|Last summer, a mosquito ___ me on the nose.|bit|P|Last summer
bite|Have you ever been ___ by a dog?|bitten|PP|Have you ever been
bite|My cat ___ me every time I touch her tail.|bites|S|every time
blow|On her birthday last week, Mia ___ out all the candles at once.|blew|P|last week
blow|The wind has ___ all the leaves off the trees.|blown|PP|has
blow|Can you ___ up these balloons for the party?|blow|B|Can you
break|Last night, I dropped my phone and ___ the screen.|broke|P|Last night
break|Oh no, somebody has ___ the classroom window!|broken|PP|has
break|Be careful, don't ___ the glass!|break|B|don't
bring|Yesterday, Noah ___ cookies for the whole class.|brought|P|Yesterday
bring|Have you ___ your gym clothes today?|brought|PP|Have you
bring|Don't forget to ___ your laptop tomorrow.|bring|B|forget to
build|Last weekend, my dad and I ___ a treehouse.|built|P|Last weekend
build|They have ___ a new skatepark near the school.|built|PP|have
build|In Minecraft, my sister always ___ huge castles.|builds|S|always
burn|Yesterday, I ___ my finger on the toaster.|burned/burnt|P|Yesterday
burn|Oops! The pizza has ___ in the oven.|burned/burnt|PP|has
burn|Will the campfire ___ all night?|burn|B|Will
buy|Last Friday, Zoé ___ a new skateboard with her savings.|bought|P|Last Friday
buy|I have just ___ tickets for the concert!|bought|PP|have just
buy|Did you ___ anything at the mall?|buy|B|Did
catch|Last week, my uncle ___ a huge fish at the lake.|caught|P|Last week
catch|The police have ___ the thief.|caught|PP|have
catch|Our goalie usually ___ every shot.|catches|S|usually
choose|Yesterday, we ___ a name for our new puppy.|chose|P|Yesterday
choose|Have you ___ your options for next year?|chosen|PP|Have you
choose|You can ___ any colour you want.|choose|B|can
come|My cousins ___ to visit us last Christmas.|came|P|last Christmas
come|Winter has finally ___!|come|PP|has
come|Will you ___ to my party on Saturday?|come|B|Will
cost|My new shoes ___ $120 last month.|cost|P|last month
cost|How much did your phone ___?|cost|B|did
cost|A movie ticket usually ___ about fifteen dollars.|costs|S|usually
cut|Last night, Dad ___ the pizza into eight slices.|cut|P|Last night
cut|I have just ___ my hair really short.|cut|PP|have just
cut|My mom ___ my hair every two months.|cuts|S|every two months
dig|Yesterday, the dog ___ a big hole in the garden.|dug|P|Yesterday
dig|The workers have ___ a tunnel under the road.|dug|PP|have
dig|Let's ___ for treasure on the beach!|dig|B|Let's
do|I ___ my homework before supper yesterday.|did|P|yesterday
do|Have you ___ the science project yet?|done|PP|Have you
do|My brother ___ his chores every Saturday morning.|does|S|every Saturday morning
draw|Last class, Félix ___ an amazing dragon.|drew|P|Last class
draw|She has ___ a comic book with twenty pages.|drawn|PP|has
draw|Can you ___ a map of the school for me?|draw|B|Can you
drink|After the game yesterday, I ___ two bottles of water.|drank|P|yesterday
drink|Who has ___ all the milk?|drunk|PP|has
drink|My grandpa ___ a coffee every morning.|drinks|S|every morning
drive|Last summer, we ___ all the way to Florida.|drove|P|Last summer
drive|Have you ever ___ a go-kart?|driven|PP|Have you ever
drive|My sister will ___ us to the arena.|drive|B|will
eat|Yesterday, we ___ poutine at the cafeteria.|ate|P|Yesterday
eat|Have you ever ___ sushi?|eaten|PP|Have you ever
eat|My dog always ___ my socks!|eats|S|always
fall|Last winter, I ___ on the ice and hurt my knee.|fell|P|Last winter
fall|A lot of snow has ___ since this morning.|fallen|PP|has
fall|Be careful, don't ___ off the ladder!|fall|B|don't
make|Yesterday, my friends and I ___ a funny video.|made|P|Yesterday
make|Have you ___ your bed this morning?|made|PP|Have you
make|My dad ___ pancakes every Sunday.|makes|S|every Sunday
mean|Sorry, I ___ to call you last night, but I forgot.|meant|P|last night
mean|What does this word ___?|mean|B|does
mean|A red light always ___ "stop."|means|S|always
meet|I ___ my best friend in kindergarten.|met|P|in kindergarten
meet|Have you ever ___ a famous person?|met|PP|Have you ever
meet|Let's ___ at the park after school.|meet|B|Let's
pay|Last week, I ___ for my own movie ticket.|paid|P|Last week
pay|Have you ___ for the school trip yet?|paid|PP|Have you
pay|Did your parents ___ for your new phone?|pay|B|Did
put|Yesterday, I ___ my keys somewhere and now I can't find them.|put|P|Yesterday
put|Who has ___ salt in my orange juice?|put|PP|has
put|My brother always ___ his dirty socks under the bed.|puts|S|always
read|Last month, I ___ the whole Harry Potter series.|read|P|Last month
read|Have you ___ the book for English class?|read|PP|Have you
read|You should ___ the instructions first.|read|B|should
ride|Last summer, I ___ my bike to school every day.|rode|P|Last summer
ride|Have you ever ___ a horse?|ridden|PP|Have you ever
ride|My little sister ___ her scooter every afternoon.|rides|S|every afternoon
ring|The bell ___ ten minutes ago.|rang|P|ten minutes ago
ring|Has the bell ___ yet?|rung|PP|Has
ring|Your phone ___ every five minutes!|rings|S|every five minutes
rise|This morning, the sun ___ at 6:30.|rose|P|This morning
rise|Prices have ___ a lot this year.|risen|PP|have
rise|The sun always ___ in the east.|rises|S|always
run|Yesterday, I ___ five kilometres without stopping.|ran|P|Yesterday
run|I have never ___ a marathon.|run|PP|have never
run|My mom ___ every morning before work.|runs|S|every morning
say|Last night, my friend ___ something really funny.|said|P|Last night
say|Have you ___ thank you to your grandma?|said|PP|Have you
say|What did the teacher ___ about the test?|say|B|did
see|I ___ a moose on the road last weekend!|saw|P|last weekend
see|Have you ___ the new Spider-Man movie?|seen|PP|Have you
see|Did you ___ the hockey game last night?|see|B|Did
sell|Last year, our class ___ chocolate bars for the trip.|sold|P|Last year
sell|The concert tickets have already ___ out.|sold|PP|have already
sell|My neighbour ___ fresh eggs every weekend.|sells|S|every weekend
send|Yesterday, I ___ you a message on Snapchat.|sent|P|Yesterday
send|Have you ___ the email to the teacher?|sent|PP|Have you
send|Don't ___ that photo to everyone!|send|B|Don't
set|Last night, I ___ my alarm for 6 a.m.|set|P|Last night
set|Have you ___ the table for supper?|set|PP|Have you
set|Can you ___ the timer for ten minutes?|set|B|Can you
sew|Last week, my grandma ___ a button on my jacket.|sewed|P|Last week
sew|She has ___ all the costumes for the school play.|sewn/sewed|PP|has
sew|Can you teach me how to ___?|sew|B|how to
shake|After the game yesterday, the players ___ hands.|shook|P|yesterday
shake|Have you ___ the bottle before opening it?|shaken|PP|Have you
shake|My dog ___ himself after every swim.|shakes|S|after every swim
shine|Yesterday, the sun ___ all day.|shone|P|Yesterday
shine|The sun has ___ every day this week.|shone|PP|has
shine|Will the sun ___ tomorrow?|shine|B|Will
shoot|In the last game, Mathis ___ the puck into the net.|shot|P|In the last game
shoot|She has ___ three goals this season.|shot|PP|has
shoot|Our best player usually ___ from the blue line.|shoots|S|usually
show|Yesterday, Lily ___ me her new puppy.|showed|P|Yesterday
show|Have you ___ your report card to your parents?|shown/showed|PP|Have you
show|Can you ___ me how this game works?|show|B|Can you
shrink|My favourite sweater ___ in the dryer last week.|shrank|P|last week
shrink|Oh no, my jeans have ___!|shrunk|PP|have
shrink|Don't wash it in hot water or it will ___.|shrink|B|will
shut|Yesterday, I ___ the door too hard and woke up the baby.|shut|P|Yesterday
shut|Have you ___ the windows? It's raining!|shut|PP|Have you
shut|Please ___ the door when you leave.|shut|B|Please
sing|At the talent show last year, Chloé ___ a Céline Dion song.|sang|P|last year
sing|Have you ever ___ karaoke?|sung|PP|Have you ever
sing|My dad ___ in the shower every morning.|sings|S|every morning
sink|The Titanic ___ in 1912.|sank|P|in 1912
sink|Our paper boat has ___ to the bottom of the pool.|sunk|PP|has
sink|Will this rock ___ or float?|sink|B|Will
sit|Yesterday, I ___ next to the new student at lunch.|sat|P|Yesterday
sit|Have you ever ___ in the front row at a concert?|sat|PP|Have you ever
sit|My cat always ___ on my keyboard.|sits|S|always
feel|I ___ sick yesterday, so I stayed home.|felt|P|yesterday
feel|I have never ___ so nervous before a test!|felt|PP|have never
feel|How do you ___ today?|feel|B|do
fight|Last night, my brother and sister ___ over the TV remote.|fought|P|Last night
fight|The firefighters have ___ the fire for hours.|fought|PP|have
fight|My cat ___ with the neighbour's dog every day.|fights|S|every day
find|Yesterday, I ___ twenty dollars on the sidewalk!|found|P|Yesterday
find|Have you ___ your lost AirPods?|found|PP|Have you
find|Did you ___ the answer to question 5?|find|B|Did
fly|Last March, we ___ to Mexico for the holidays.|flew|P|Last March
fly|Have you ever ___ in a helicopter?|flown|PP|Have you ever
fly|My uncle ___ to Europe every month for work.|flies|S|every month
forbid|Last year, the school ___ cell phones in class.|forbade|P|Last year
forbid|Junk food has been ___ in the cafeteria.|forbidden|PP|has been
forbid|Will the teacher ___ calculators on the test?|forbid|B|Will
forget|Yesterday, I ___ my lunch at home.|forgot|P|Yesterday
forget|Oh no! I have ___ my password again.|forgotten|PP|have
forget|Don't ___ to study for the quiz!|forget|B|Don't
forgive|My best friend ___ me after our fight last week.|forgave|P|last week
forgive|Has she ___ you for breaking her phone?|forgiven|PP|Has
forgive|Can you ___ me? I'm really sorry.|forgive|B|Can you
freeze|Last night, the lake ___ completely.|froze|P|Last night
freeze|My computer has ___ again!|frozen|PP|has
freeze|Water ___ at zero degrees Celsius.|freezes|S|at zero degrees
get|Yesterday, I ___ a new phone for my birthday.|got|P|Yesterday
get|My marks have ___ better since September.|got/gotten|PP|have
get|My sister usually ___ home at five o'clock.|gets|S|usually
give|Last Christmas, my aunt ___ me a hoodie.|gave|P|Last Christmas
give|Has the teacher ___ back our tests?|given|PP|Has
give|Can you ___ me a hand with this box?|give|B|Can you
go|Last weekend, we ___ to La Ronde.|went|P|Last weekend
go|Have you ever ___ skiing at Mont-Tremblant?|gone|PP|Have you ever
go|My brother ___ to the gym every day.|goes|S|every day
grow|My little brother ___ ten centimetres last year!|grew|P|last year
grow|Wow, you have ___ so much since last summer!|grown|PP|have
grow|My hair ___ about one centimetre every month.|grows|S|every month
have|We ___ a great time at the party last night.|had|P|last night
have|I have ___ the same phone for three years.|had|PP|have
have|My best friend ___ two cats and a hamster.|has|S|My best friend
hear|Last night, I ___ a strange noise in the basement.|heard|P|Last night
hear|Have you ___ the new Drake song?|heard|PP|Have you
hear|Did you ___ that noise?|hear|B|Did
hit|Yesterday, the ball ___ me right in the face.|hit|P|Yesterday
hit|He has ___ three home runs this season.|hit|PP|has
hit|Our pitcher always ___ the target.|hits|S|always
hold|At the concert last night, everyone ___ up their phone.|held|P|last night
hold|Have you ever ___ a snake?|held|PP|Have you ever
hold|Can you ___ my backpack for a minute?|hold|B|Can you
hurt|I ___ my ankle during the basketball game yesterday.|hurt|P|yesterday
hurt|Has anyone ___ themselves on the trampoline?|hurt|PP|Has
hurt|My back ___ when I sit too long.|hurts|S|when I sit too long
keep|Last year, I ___ all my notes in a binder.|kept|P|Last year
keep|She has ___ her promise.|kept|PP|has
keep|Can you ___ a secret?|keep|B|Can you
know|I ___ the answer, but I forgot it during the test yesterday.|knew|P|yesterday
know|I have ___ my best friend since kindergarten.|known|PP|have
know|Do you ___ where my charger is?|know|B|Do you
lead|Last week, Jade ___ our team to victory.|led|P|Last week
lead|Our coach has ___ the team for five years.|led|PP|has
lead|This path ___ to the lake.|leads|S|This path
leave|The bus ___ without me this morning!|left|P|this morning
leave|Has everyone ___ the gym?|left|PP|Has
leave|My dad ___ for work at seven every morning.|leaves|S|every morning
lend|Yesterday, Thomas ___ me his calculator.|lent|P|Yesterday
lend|I have ___ my charger to someone, but I don't remember who.|lent|PP|have
lend|Can you ___ me a pencil, please?|lend|B|Can you
let|Last night, my parents ___ me stay up late.|let|P|Last night
let|Has your mom ___ you go to the party?|let|PP|Has
let|My teacher never ___ us use our phones in class.|lets|S|never
lie|Yesterday, I ___ on the beach all afternoon.|lay|P|Yesterday
lie|The dog has ___ in front of the fireplace all evening.|lain|PP|has
lie|After lunch, my cat always ___ in the sun.|lies|S|always
lose|We ___ the game 3 to 1 last night.|lost|P|last night
lose|I have ___ my keys again!|lost|PP|have
lose|Don't ___ your bus pass!|lose|B|Don't
sleep|Last night, I only ___ five hours.|slept|P|Last night
sleep|Have you ever ___ in a tent?|slept|PP|Have you ever
sleep|My cat ___ almost twenty hours a day.|sleeps|S|a day
slide|Yesterday, I ___ down the hill on my sled.|slid|P|Yesterday
slide|The puck has ___ under the bench.|slid|PP|has
slide|Be careful, you could ___ on the ice!|slide|B|could
speak|Last week, a famous athlete ___ at our school.|spoke|P|Last week
speak|Have you ___ to the principal about it?|spoken|PP|Have you
speak|My grandmother ___ three languages.|speaks|S|My grandmother
speed|The car ___ past the school yesterday.|sped|P|yesterday
speed|The runner has ___ up in the last lap.|sped|PP|has
speed|Don't ___ in the school zone!|speed|B|Don't
spend|Last summer, I ___ two weeks at camp.|spent|P|Last summer
spend|I have ___ all my money on video games!|spent|PP|have
spend|How much time do you ___ on your phone?|spend|B|do you
stand|Yesterday, we ___ in line for an hour to get tickets.|stood|P|Yesterday
stand|Have you ever ___ on a stage in front of a crowd?|stood|PP|Have you ever
stand|Please ___ up for the national anthem.|stand|B|Please
steal|Last night, someone ___ my bike!|stole|P|Last night
steal|My bike has been ___!|stolen|PP|has been
steal|My little brother always ___ my fries.|steals|S|always
stick|Yesterday, I ___ a poster on my bedroom wall.|stuck|P|Yesterday
stick|My gum has ___ to my shoe!|stuck|PP|has
stick|This tape doesn't ___ very well.|stick|B|doesn't
sting|Last summer, a wasp ___ me on the arm.|stung|P|Last summer
sting|Have you ever been ___ by a bee?|stung|PP|Have you ever been
sting|Does it ___ when you put alcohol on a cut?|sting|B|Does
stink|Yesterday, the cafeteria ___ of burnt toast.|stank|P|Yesterday
stink|Your gym bag has ___ for days!|stunk|PP|has
stink|My brother's hockey bag always ___!|stinks|S|always
strike|Last night, lightning ___ the old tree.|struck|P|Last night
strike|The town has been ___ by a big storm.|struck|PP|has been
strike|The clock ___ twelve every day at noon.|strikes|S|every day
swear|Yesterday, Mia ___ she would never tell anyone.|swore|P|Yesterday
swear|He has ___ to tell the truth.|sworn|PP|has
swear|Do you ___ you didn't eat my chocolate?|swear|B|Do you
sweep|After the party last night, we ___ the floor.|swept|P|last night
sweep|Has anyone ___ the kitchen today?|swept|PP|Has
sweep|My dad ___ the garage every Saturday.|sweeps|S|every Saturday
swim|Last summer, we ___ in the lake every day.|swam|P|Last summer
swim|Have you ever ___ in the ocean?|swum|PP|Have you ever
swim|Can you ___ underwater?|swim|B|Can you
take|Yesterday, I ___ the bus to school.|took|P|Yesterday
take|Who has ___ my charger?|taken|PP|has
take|My sister ___ a hundred selfies every day!|takes|S|every day
teach|Last summer, my cousin ___ me how to skate.|taught|P|Last summer
teach|Mr. Gagnon has ___ English for twenty years.|taught|PP|has
teach|Can you ___ me that dance?|teach|B|Can you
tear|Yesterday, I ___ my jeans on a fence.|tore|P|Yesterday
tear|Oh no, the page has ___!|torn|PP|has
tear|Be careful not to ___ the paper.|tear|B|not to
tell|Last night, my grandpa ___ us a scary story.|told|P|Last night
tell|Have you ___ your parents about the trip?|told|PP|Have you
tell|Don't ___ anyone my secret!|tell|B|Don't
think|Yesterday, I ___ about you when I heard that song.|thought|P|Yesterday
think|Have you ___ about what you want for your birthday?|thought|PP|Have you
think|What do you ___ of my new haircut?|think|B|do you
throw|In the last game, the pitcher ___ the ball very fast.|threw|P|In the last game
throw|Who has ___ paper on the floor?|thrown|PP|has
throw|Don't ___ snowballs at the windows!|throw|B|Don't
understand|I finally ___ the math lesson yesterday.|understood|P|yesterday
understand|Have you ___ the instructions?|understood|PP|Have you
understand|Do you ___ what I mean?|understand|B|Do you
wake|This morning, I ___ up at 6 o'clock.|woke|P|This morning
wake|Has the baby ___ up yet?|woken|PP|Has
wake|My dog always ___ me up at sunrise.|wakes|S|always
wear|At the party last Saturday, Léa ___ a red dress.|wore|P|last Saturday
wear|I have ___ these sneakers every day this year.|worn|PP|have
wear|You have to ___ a helmet on your bike.|wear|B|have to
win|Last year, our school ___ the robotics competition.|won|P|Last year
win|Have you ever ___ a trophy?|won|PP|Have you ever
win|Will the Canadiens ___ the Stanley Cup this year?|win|B|Will
write|Last week, I ___ a poem for my grandma.|wrote|P|Last week
write|Have you ___ your essay yet?|written|PP|Have you
write|My favourite author ___ a new book every year.|writes|S|every year
`.trim().split('\n').map((l) => { const [v, s, r, f, c] = l.split('|'); return { v, s, r, f, c: c || '' }; });
