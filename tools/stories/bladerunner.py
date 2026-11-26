META = {"id": "bladerunner", "title": "Blade Runner (both films)", "type": "movie", "background": "assets/bg/bladerunner.webp",
        "unit": "Minute", "partLabel": "Film",
        "parts": [{"n": "Blade Runner (1982, Final Cut)", "short": "Blade Runner"}, {"n": "Blade Runner 2049 (2017)", "short": "Blade Runner 2049"}]}

# positions: 1000 + minute in the first film, 2000 + minute in 2049. Minutes are rounded up so nothing shows early.
STEPS = [
    (1008, "The test", "Los Angeles, 2019. During a Voight-Kampff test, the replicant Leon shoots the blade runner Holden.", ["voight-kampff", "leon", "holden", "test", "tortoise"]),
    (1016, "Brought back in", "Ex-cop Rick Deckard is pulled back in by Bryant and Gaff. Four Nexus-6 replicants have come to Earth: Roy, Leon, Zhora and Pris.", ["deckard", "bryant", "gaff", "noodle bar", "nexus-6", "briefing"]),
    (1024, "Tyrell's owl", "At the Tyrell Corporation Deckard tests Tyrell's assistant Rachael and finds she is a replicant who doesn't know it.", ["tyrell", "rachael", "owl", "replicant test"]),
    (1029, "Chew's eyes", "Roy and Leon frighten the eye maker Chew, who points them to J.F. Sebastian.", ["chew", "eyes", "eye maker", "cold"]),
    (1034, "Leon's room", "Deckard searches Leon's hotel room and finds photographs and a scale.", ["hotel", "photos", "scale", "leon's room"]),
    (1039, "Sebastian", "Pris meets the lonely genetic designer J.F. Sebastian and moves into his building.", ["pris", "sebastian", "bradbury", "toys"]),
    (1046, "Memories", "Rachael brings Deckard a childhood photo. He tells her her memories are implants from Tyrell's niece.", ["photo", "implants", "memories", "spider"]),
    (1058, "Zhora", "Deckard tracks Zhora to a club through the snake scale and shoots her as she runs through the streets.", ["zhora", "snake", "club", "shot", "glass"]),
    (1062, "Leon", "Leon attacks Deckard; Rachael shoots Leon dead.", ["leon dies", "rachael shoots", "street"]),
    (1068, "Rachael", "Rachael stays at Deckard's apartment. They fall for each other.", ["piano", "kiss", "apartment", "love"]),
    (1084, "Tyrell", "Roy uses Sebastian to reach Tyrell, asks for more life, and kills Tyrell when he can't give it. Sebastian dies too.", ["more life", "chess", "tyrell dies", "father"]),
    (1095, "Pris", "Deckard enters Sebastian's apartment and kills Pris.", ["pris dies", "dolls", "apartment"]),
    (1108, "Tears in rain", "Roy hunts Deckard through the building, then saves him from a fall and dies on the roof.", ["tears in rain", "roof", "dove", "roy dies", "rain"]),
    (1117, "Unicorn", "Gaff leaves an origami unicorn at Deckard's door. Deckard leaves with Rachael.", ["origami", "unicorn", "elevator", "leave"]),
    (2016, "Sapper", "2049. Replicant blade runner K retires Sapper Morton and finds a box buried under a tree.", ["k", "sapper", "farm", "box", "tree", "grubs"]),
    (2026, "The bones", "The box holds a replicant woman who died giving birth. Lt. Joshi orders K to erase the child.", ["bones", "birth", "joshi", "miracle", "child"]),
    (2034, "Wallace", "Niander Wallace wants the secret of replicant birth. His enforcer Luv learns the woman was Rachael.", ["wallace", "luv", "archive", "rachael's voice"]),
    (2042, "Luv", "Luv steals the bones from police headquarters and kills a technician.", ["stolen", "bones", "coco", "police"]),
    (2052, "6-10-21", "K finds the date carved on the tree matches a memory of his own.", ["date", "6-10-21", "carved", "horse memory"]),
    (2078, "The orphanage", "At a San Diego orphanage K finds a wooden horse where his memory said it would be.", ["orphanage", "wooden horse", "furnace", "san diego"]),
    (2088, "Dr. Ana Stelline", "Memory maker Ana Stelline tells K the memory is real. K believes he is the child.", ["ana stelline", "memory maker", "bubble", "real memory"]),
    (2094, "Joi and Mariette", "K's hologram companion Joi hires Mariette to be with him.", ["joi", "mariette", "hologram", "sync"]),
    (2112, "Las Vegas", "K tracks the horse to ruined Las Vegas and finds Deckard.", ["las vegas", "casino", "dog", "elvis"]),
    (2122, "Captured", "Luv kills Joshi, crushes Joi's emitter and takes Deckard.", ["joshi dies", "joi destroyed", "deckard taken", "crash"]),
    (2128, "Freysa", "Freysa's resistance saves K and tells him the child was a girl. He is not the one.", ["freysa", "resistance", "girl", "not you"]),
    (2136, "Wallace and Deckard", "Wallace tempts Deckard with a new Rachael. Deckard refuses.", ["new rachael", "green eyes", "refuses"]),
    (2150, "The sea wall", "K stops Luv's convoy at the sea wall and drowns her, saving Deckard.", ["sea wall", "luv dies", "drown", "waves"]),
    (2160, "Snow", "K brings Deckard to meet his daughter Ana, then lies down on the steps in the snow.", ["snow", "daughter", "steps", "end", "ana"]),
]

CHARS = [
    ("deckard", "Rick Deckard", "Blade runner", 1016, [
        (1016, "Retired blade runner brought back to hunt four replicants."),
        (1058, "Retires Zhora."),
        (1068, "Falls for Rachael."),
        (1108, "Spared by Roy."),
        (1117, "Leaves with Rachael."),
        (2112, "Living alone in Las Vegas for 30 years."),
        (2136, "Refuses Wallace's copy of Rachael."),
        (2160, "Meets his daughter."),
    ], {"main": True}),
    ("rachael", "Rachael", "Tyrell's assistant", 1024, [
        (1024, "A replicant with implanted memories."),
        (1062, "Shoots Leon to save Deckard."),
        (2026, "Died giving birth; the buried bones are hers."),
    ], {"dead": 2026}),
    ("roy", "Roy Batty", "Replicant leader", 1016, [
        (1016, "Combat model and leader of the four replicants."),
        (1084, "Kills Tyrell."),
        (1108, "Saves Deckard and dies."),
    ], {"dead": 1108}),
    ("leon", "Leon Kowalski", "Replicant", 1008, [
        (1008, "Shoots Holden during a test."),
        (1034, "Keeps photographs as memories."),
        (1062, "Shot by Rachael."),
    ], {"dead": 1062}),
    ("zhora", "Zhora", "Replicant", 1016, [
        (1016, "Trained as an assassin."),
        (1058, "Works as a snake dancer; retired by Deckard."),
    ], {"dead": 1058}),
    ("pris", "Pris", "Replicant", 1016, [
        (1039, "Gets close to J.F. Sebastian."),
        (1095, "Killed by Deckard."),
    ], {"dead": 1095}),
    ("tyrell", "Eldon Tyrell", "Replicant maker", 1024, [
        (1024, "Head of the Tyrell Corporation."),
        (1084, "Killed by Roy."),
    ], {"dead": 1084}),
    ("sebastian", "J.F. Sebastian", "Genetic designer", 1039, [
        (1039, "Lonely designer who ages too fast."),
        (1084, "Killed after Roy reaches Tyrell."),
    ], {"dead": 1084}),
    ("gaff", "Gaff", "Police officer", 1016, [
        (1016, "Bryant's man who folds origami."),
        (1117, "Leaves the unicorn: he spared Rachael."),
    ]),
    ("bryant", "Bryant", "Police captain", 1016, [(1016, "Deckard's old boss.")]),
    ("holden", "Holden", "Blade runner", 1008, [(1008, "Shot by Leon during the test.")]),
    ("chew", "Hannibal Chew", "Eye maker", 1029, [(1029, "Made the replicants' eyes; tells Roy about Sebastian.")]),
    ("k", "K", "Replicant blade runner", 2016, [
        (2016, "Newer replicant who hunts old models."),
        (2052, "A memory of his own matches the date."),
        (2088, "Believes he is the child."),
        (2128, "Learns he is not."),
        (2150, "Saves Deckard from Luv."),
        (2160, "Brings Deckard to his daughter."),
    ], {"main": True}),
    ("joi", "Joi", "K's hologram", 2016, [
        (2016, "K's holographic companion."),
        (2122, "Destroyed by Luv."),
    ], {"dead": 2122}),
    ("joshi", "Lt. Joshi", "K's boss", 2016, [
        (2026, "Orders K to destroy all traces of the child."),
        (2122, "Killed by Luv."),
    ], {"dead": 2122}),
    ("sapper", "Sapper Morton", "Old replicant", 2016, [(2016, "A Nexus-8 farmer; retired by K.")], {"dead": 2016}),
    ("wallace", "Niander Wallace", "Replicant maker", 2034, [
        (2034, "Bought Tyrell's company; wants replicants that can give birth."),
        (2136, "Offers Deckard a new Rachael."),
    ]),
    ("luv", "Luv", "Wallace's enforcer", 2034, [
        (2042, "Steals the bones."),
        (2122, "Kills Joshi and takes Deckard."),
        (2150, "Drowned by K."),
    ], {"dead": 2150}),
    ("ana", "Dr. Ana Stelline", "Memory maker", 2088, [
        (2088, "Designs memories for replicants."),
        (2160, "Deckard and Rachael's daughter."),
    ]),
    ("mariette", "Mariette", "Resistance member", 2094, [(2094, "Spends a night with K; works for Freysa.")]),
    ("freysa", "Freysa", "Resistance leader", 2128, [(2128, "Leads the replicant resistance; saw the child born.")]),
    ("horse", "The wooden horse", "Childhood toy", 2052, [
        (2052, "From the memory K thinks is his."),
        (2078, "Found at the orphanage."),
    ], {"note": True}),
]

LINKS = [
    ("leon", "holden", 1008), ("deckard", "bryant", 1016), ("deckard", "gaff", 1016), ("roy", "leon", 1016), ("roy", "zhora", 1016),
    ("roy", "pris", 1016), ("deckard", "rachael", 1024), ("rachael", "tyrell", 1024), ("roy", "chew", 1029), ("deckard", "leon", 1034),
    ("pris", "sebastian", 1039), ("deckard", "zhora", 1058), ("rachael", "leon", 1062), ("roy", "sebastian", 1084), ("roy", "tyrell", 1084),
    ("sebastian", "tyrell", 1084), ("deckard", "pris", 1095), ("deckard", "roy", 1108), ("gaff", "rachael", 1117),
    ("k", "sapper", 2016), ("k", "joi", 2016), ("k", "joshi", 2016), ("rachael", "deckard", 2026), ("wallace", "luv", 2034),
    ("luv", "rachael", 2034), ("luv", "k", 2042), ("k", "horse", 2052), ("k", "ana", 2088), ("ana", "horse", 2088),
    ("k", "mariette", 2094), ("k", "deckard", 2112), ("luv", "joshi", 2122), ("luv", "joi", 2122), ("luv", "deckard", 2122),
    ("mariette", "freysa", 2128), ("k", "freysa", 2128), ("wallace", "deckard", 2136), ("ana", "deckard", 2160), ("ana", "rachael", 2160),
]

COUPLES = [("deckard", "rachael", 1068), ("k", "joi", 2016)]
