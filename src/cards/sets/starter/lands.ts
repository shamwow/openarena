import { CardBuilder } from '../../CardBuilder';
import { CardType, ManaColor } from '../../../engine/types';

// --- Basic Lands ---

export const Plains = CardBuilder.create('Plains')
  .types(CardType.LAND)
  .supertypes('Basic')
  .subtypes('Plains')
  .colors(ManaColor.WHITE)
  .tapForMana('W')
  .oracleText('{T}: Add {W}.')
  .build();

export const Island = CardBuilder.create('Island')
  .types(CardType.LAND)
  .supertypes('Basic')
  .subtypes('Island')
  .colors(ManaColor.BLUE)
  .tapForMana('U')
  .oracleText('{T}: Add {U}.')
  .build();

export const Swamp = CardBuilder.create('Swamp')
  .types(CardType.LAND)
  .supertypes('Basic')
  .subtypes('Swamp')
  .colors(ManaColor.BLACK)
  .tapForMana('B')
  .oracleText('{T}: Add {B}.')
  .build();

export const Mountain = CardBuilder.create('Mountain')
  .types(CardType.LAND)
  .supertypes('Basic')
  .subtypes('Mountain')
  .colors(ManaColor.RED)
  .tapForMana('R')
  .oracleText('{T}: Add {R}.')
  .build();

export const Forest = CardBuilder.create('Forest')
  .types(CardType.LAND)
  .supertypes('Basic')
  .subtypes('Forest')
  .colors(ManaColor.GREEN)
  .tapForMana('G')
  .oracleText('{T}: Add {G}.')
  .build();

// --- Nonbasic Lands ---

export const CommandTower = CardBuilder.create('Command Tower')
  .types(CardType.LAND)
  .tapForAnyColor()
  .oracleText('{T}: Add one mana of any color in your commander\'s color identity.')
  .build();

export const ExoticOrchard = CardBuilder.create('Exotic Orchard')
  .types(CardType.LAND)
  .tapForAnyColor()
  .oracleText('{T}: Add one mana of any color that a land an opponent controls could produce.')
  .build();

export const ReliquaryTower = CardBuilder.create('Reliquary Tower')
  .types(CardType.LAND)
  .tapForMana('C')
  .oracleText('You have no maximum hand size.\n{T}: Add {C}.')
  .build();
