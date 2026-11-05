// Gemeinsame biologische Referenzen für Weltmaßstab und Chronik.
// Fossilgrößen sind Näherungen ausgewachsener Tiere, keine exakt bekannten Naturkonstanten.
export interface SpeciesFact {
  /** wissenschaftlicher Name */
  latin: string;
  /** Länge in Zentimetern (ungefähr) */
  cm: number;
  /** vor so vielen Millionen Jahren (ungefähr) */
  ma: number;
  /** ein, zwei Sätze zum Tier */
  note: string;
}

export const SPECIES_FACTS: Record<string, SpeciesFact> = {
  kieferlos: { latin: 'Agnatha', cm: 15, ma: 480, note: 'The earliest fishes had no jaws, only a round sucking mouth. They filtered food from water and mud.' },
  sacabambaspis: { latin: 'Sacabambaspis janvieri', cm: 35, ma: 450, note: 'Its eyes sit at the very front of its head, and bony armour encloses its body. Found in Bolivia, it is one of the most complete fishes known from its time.' },
  birkenia: { latin: 'Birkenia elegans', cm: 8, ma: 425, note: 'A small jawless fish with a row of sharp spines along its back. It swam in schools through shallow waters and estuaries.' },
  cephalaspis: { latin: 'Cephalaspis lyelli', cm: 22, ma: 410, note: 'Its head bears a semicircular, horseshoe-shaped bony shield. With its flat belly resting on the bottom, it searched the mud for food.' },
  cheiracanthus: { latin: 'Cheiracanthus murchisoni', cm: 25, ma: 390, note: 'A spiny shark: not a true shark, but a separate branch of early jawed fishes with strong spines in front of their fins. It lived in schools.' },
  bothriolepis: { latin: 'Bothriolepis canadensis', cm: 30, ma: 380, note: 'An armoured fish with two armoured rowing appendages in place of pectoral fins. It lived on the bottom and was extremely abundant, appearing in many fossil deposits.' },
  cladoselache: { latin: 'Cladoselache fyleri', cm: 180, ma: 370, note: 'An early shark, torpedo-shaped and very fast. It hunted smaller fishes in open water, often swallowing them whole.' },
  rolfosteus: { latin: 'Rolfosteus canningensis', cm: 45, ma: 380, note: 'An armoured fish with a long pointed projection on its snout. It lived on a reef in what is now Australia.' },
  eusthenopteron: { latin: 'Eusthenopteron foordi', cm: 100, ma: 385, note: 'A lobe-finned fish: bones inside its powerful fins resemble the arms and legs of later land animals. A large predator of rivers and coasts.' },
  arandaspis: { latin: 'Arandaspis prionotolepis', cm: 15, ma: 470, note: 'One of the oldest armoured vertebrates, found in Australia. Its head is enclosed in a shield of bony plates, and it has no jaws.' },
  astraspis: { latin: 'Astraspis desiderata', cm: 20, ma: 460, note: 'Its armour forms a mosaic of small, knobbly bony plates. It lived in shallow seas in what is now North America.' },
  eriptychius: { latin: 'Eriptychius americanus', cm: 30, ma: 450, note: 'A jawless fish with thick armour of bone and dentine. Its remains were found in Colorado and are among the oldest vertebrate fossils known.' },
  conodont: { latin: 'Promissum pulchrum', cm: 40, ma: 445, note: 'An eel-like animal with large eyes and rows of tiny teeth. For a long time, only the teeth were known; the whole animal was discovered much later.' },
  isotelus: { latin: 'Isotelus rex', cm: 70, ma: 450, note: 'One of the largest trilobites ever found. Its smooth, broad armour resembles a spoon; it ploughed through the mud.' },
  pteraspis: { latin: 'Pteraspis rostrata', cm: 20, ma: 410, note: 'Its head shield extends into a long beak, and its tail has an elongated lower lobe. It swam in open water, filtering small organisms.' },
  thelodus: { latin: 'Thelodus parvidens', cm: 15, ma: 430, note: 'Instead of armour, it bears tiny tooth-like scales. It had a flattened body and swam in large schools.' },
  jamoytius: { latin: 'Jamoytius kerwoodi', cm: 25, ma: 430, note: 'Long and slender like an eel, with fin margins along its back and belly. Its diet is still not fully understood.' },
  lasanius: { latin: 'Lasanius problematicus', cm: 10, ma: 430, note: 'A small, deep-bodied jawless fish from Scotland with a row of scales along its flank. It belongs to the anaspids.' },
  climatius: { latin: 'Climatius reticulatus', cm: 8, ma: 420, note: 'A tiny spiny shark with two rows of long spines along its belly and back, making it difficult to swallow.' },
  entelognathus: { latin: 'Entelognathus primordialis', cm: 20, ma: 423, note: 'One of the first fishes with true jaw bones like those of later bony fishes. An armoured hunter discovered in China.' },
  dalmanites: { latin: 'Dalmanites limulurus', cm: 10, ma: 430, note: 'A trilobite with large compound eyes, a helmet-like head and a long spine on its tail.' },
  coccosteus: { latin: 'Coccosteus cuspidatus', cm: 40, ma: 385, note: 'An armoured fish with a shearing mouth. Its head and chest were protected by armour, and a neck joint allowed the head to open wide.' },
  pterichthyodes: { latin: 'Pterichthyodes milleri', cm: 15, ma: 385, note: 'A winged fish: its armoured pectoral fins resemble arms or wings. It lived in Scottish lakes.' },
  dipterus: { latin: 'Dipterus valenciennesi', cm: 35, ma: 385, note: 'An early lungfish with fleshy fins and powerful tooth plates for crushing shells.' },
  osteolepis: { latin: 'Osteolepis macrolepidotus', cm: 20, ma: 385, note: 'A small lobe-finned fish with large, shiny scales. It hunted small animals in lakes and rivers.' },
  cheirolepis: { latin: 'Cheirolepis trailli', cm: 55, ma: 390, note: 'One of the earliest ray-finned fishes, the group that includes most living fishes. Slender, fast and a voracious predator.' },
  moythomasia: { latin: 'Moythomasia durgaringa', cm: 6, ma: 380, note: 'A small early ray-finned fish with shiny diamond-shaped scales. It comes from the Gogo Reef in what is now Australia.' },
  stethacanthus: { latin: 'Stethacanthus altonensis', cm: 70, ma: 360, note: 'A shark with a dorsal fin shaped like an anvil or ironing board and covered in tiny teeth. Its purpose still puzzles researchers.' },
  tiktaalik: { latin: 'Tiktaalik roseae', cm: 250, ma: 375, note: 'A fish with a neck, a flat crocodile-like head and fins that are almost arms. A transitional form on the journey from water to land.' },
  drepanaspis: { latin: 'Drepanaspis gemuendenensis', cm: 35, ma: 400, note: 'Flat like a flounder, with a forward-facing mouth. It sifted the bottom for food. Its fossils were found in Germany\'s Hunsrück region.' },
  holoptychius: { latin: 'Holoptychius flemingi', cm: 100, ma: 370, note: 'A large lobe-finned fish with thick, rippled scales. It was a predator of rivers and lagoons.' },
  acanthodes: { latin: 'Acanthodes bronni', cm: 30, ma: 380, note: 'A toothless spiny shark. It filtered plankton from open water and travelled in schools.' },
  trilobit: { latin: 'Trilobita', cm: 5, ma: 500, note: 'Arthropods with three-lobed armour that inhabited the seas for over 250 million years. More than 20,000 species are known.' },
  qualle: { latin: 'Scyphozoa', cm: 10, ma: 500, note: 'Jellyfish existed before fishes. Their stinging cells burn, so touching them is best avoided.' },
  orthoceras: { latin: 'Orthoceras regulare', cm: 60, ma: 470, note: 'A straight-shelled cephalopod related to modern squid. It hunted crustaceans and small fishes.' },
  cameroceras: { latin: 'Cameroceras', cm: 600, ma: 470, note: 'One of the largest cephalopods: its straight shell could grow several metres long. A shadow that other animals kept clear of.' },
  seeskorpion: { latin: 'Eurypterus remipes', cm: 20, ma: 420, note: 'Sea scorpions were relatives of spiders and horseshoe crabs, rather than true scorpions. They rowed through the water with paddle-like legs.' },
  dunkleosteus: { latin: 'Dunkleosteus terrelli', cm: 410, ma: 370, note: 'A large Devonian armoured fish. Recent body reconstructions suggest about 3.4 to 4.1 metres; its length is estimated because the rear body is rarely preserved. Sharp bony blades replaced teeth and delivered tremendous bite force.' },
  megalograptus: { latin: 'Megalograptus ohioensis', cm: 130, ma: 450, note: 'A large sea scorpion with spiny pincers on its front limbs. It hunted worms, crustaceans and fishes along the seabed.' },
  pterygotus: { latin: 'Pterygotus anglicus', cm: 200, ma: 420, note: 'A giant among sea scorpions: almost two metres long, with powerful pincers and enormous eyes. It was one of the largest predators of its time.' },
  hyneria: { latin: 'Hyneria lindae', cm: 280, ma: 365, note: 'A giant lobe-finned fish with powerful fangs, hunting rivers and estuaries in the Late Devonian.' },
  // ---- Karbon
  elonichthys: { latin: 'Elonichthys robisoni', cm: 15, ma: 340, note: 'A small ray-finned fish with shiny diamond-shaped scales. Large schools travelled through Carboniferous swamps and lagoons.' },
  tealliocaris: { latin: 'Tealliocaris woodwardi', cm: 5, ma: 340, note: 'A shrimp-like crustacean from Scotland\'s lagoons. It searched the bottom for food and was itself prey for almost everything.' },
  bellinurus: { latin: 'Bellinurus regina', cm: 6, ma: 310, note: 'A horseshoe crab, distantly related to spiders and scorpions. Its relatives still live along coasts with a very similar body plan.' },
  ctenodus: { latin: 'Ctenodus cristatus', cm: 120, ma: 330, note: 'A large lungfish with comb-like tooth plates. It could gulp air, an advantage in oxygen-poor swamp water.' },
  hibbertopterus: { latin: 'Hibbertopterus scouleri', cm: 160, ma: 335, note: 'A huge sea scorpion that sifted mud for small animals using bristly combs on its legs. Fossil tracks show that it also walked on land.' },
  tausendfuss: { latin: 'Myriapoda', cm: 6, ma: 340, note: 'Millipedes were among the first animals to colonise land. In the Carboniferous, they crawled through leaf litter and rotting wood; some grew enormous.' },
  urinsekt: { latin: 'Dasyleptus', cm: 3, ma: 320, note: 'A wingless early insect with three tail filaments. Insects were still newcomers, and the earliest could not fly.' },
  trigonotarbid: { latin: 'Palaeocharinus', cm: 2, ma: 350, note: 'A small arachnid, related to spiders but not a true spider. It ambushed smaller animals among mosses and ferns.' },
  pulmonoscorpius: { latin: 'Pulmonoscorpius kirktonensis', cm: 70, ma: 336, note: 'An arm-length scorpion found at East Kirkton in Scotland, not far from Pederpes. A dangerous hunter on land.' },
  megalichthys: { latin: 'Megalichthys hibberti', cm: 150, ma: 320, note: 'A lobe-finned fish with glossy, varnish-like scales and powerful fangs. It hunted in the coal swamps.' },
  crassigyrinus: { latin: 'Crassigyrinus scoticus', cm: 200, ma: 335, note: 'A tetrapod that never went onto land, with tiny legs and a huge mouth. It ambushed fishes and smaller tetrapods in the water.' },
  strepsodus: { latin: 'Strepsodus sauroides', cm: 300, ma: 330, note: 'A rhizodont: a giant lobe-finned fish with curved fangs. It hunted in rivers and swamps, attacking animals that entered the water.' },
  rhizodus: { latin: 'Rhizodus hibberti', cm: 700, ma: 340, note: 'The largest lobe-finned fish ever known, up to seven metres long with dagger-sized fangs. A dominant predator of Early Carboniferous waters.' },
  // ---- Kreidezeit
  apsopelix: { latin: 'Apsopelix anglicus', cm: 30, ma: 85, note: 'A small herring-like fish that travelled in large schools through the inland sea, providing food for almost every larger hunter.' },
  gillicus: { latin: 'Gillicus arcuatus', cm: 200, ma: 85, note: 'Large but harmless: it used tiny teeth to sieve small organisms from the water. One was found inside a Xiphactinus, swallowed whole.' },
  ammonit: { latin: 'Placenticeras meeki', cm: 60, ma: 75, note: 'A cephalopod with a coiled, chambered shell that provided buoyancy. Many shells bear mosasaur bite marks.' },
  baculites: { latin: 'Baculites ovatus', cm: 100, ma: 75, note: 'An ammonite with an almost straight shell. It probably drifted at an angle, head down, catching small animals.' },
  enchodus: { latin: 'Enchodus petrosus', cm: 100, ma: 80, note: 'The sabre-toothed herring: a predatory fish with long fangs at the front of its mouth. It was common and was itself frequent prey for marine reptiles.' },
  protosphyraena: { latin: 'Protosphyraena perniciosa', cm: 300, ma: 85, note: 'A fast hunter with a sword-like snout and sickle-shaped pectoral fins. It resembles a swordfish but is not closely related.' },
  squalicorax: { latin: 'Squalicorax falcatus', cm: 250, ma: 80, note: 'The crow shark: its serrated teeth have been found in bones of marine reptiles, turtles and even dinosaurs washed out to sea. It also scavenged.' },
  xiphactinus: { latin: 'Xiphactinus audax', cm: 500, ma: 85, note: 'A shark-sized predatory fish with a projecting lower jaw and long fangs. A famous fossil preserves one with an almost two-metre-long fish inside its stomach.' },
  archelon: { latin: 'Archelon ischyros', cm: 400, ma: 75, note: 'The largest sea turtle ever known: four metres long, with a leathery shell and a powerful hooked beak. It probably ate jellyfish and ammonites.' },
  cretoxyrhina: { latin: 'Cretoxyrhina mantelli', cm: 700, ma: 85, note: 'A giant shark built like a great white, with razor-sharp teeth that earned it the nickname Ginsu shark. It hunted fishes, marine reptiles and plesiosaurs.' },
  platecarpus: { latin: 'Platecarpus tympaniticus', cm: 550, ma: 82, note: 'A medium-sized mosasaur, slender and fast, with a shark-like tail fin. It hunted fishes and cephalopods.' },
  elasmosaurus: { latin: 'Elasmosaurus platyurus', cm: 1300, ma: 80, note: 'A plesiosaur whose neck was longer than the rest of its body, with over 70 neck vertebrae. It flew through the water on four flippers, snapping at schools of fish.' },
  tylosaurus: { latin: 'Tylosaurus proriger', cm: 1300, ma: 82, note: 'One of the largest mosasaurs, with a long bony snout that could ram prey. Fishes, sharks, plesiosaurs and even a seabird have been found in its stomach.' },
  mosasaurus: { latin: 'Mosasaurus hoffmannii', cm: 1500, ma: 70, note: 'A dominant predator of the Late Cretaceous seas: a marine reptile up to fifteen metres long, with a mouth full of conical teeth. Few animals could challenge it.' },
};

