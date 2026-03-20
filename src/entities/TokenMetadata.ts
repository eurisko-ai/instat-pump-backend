import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('token_metadata')
export class TokenMetadata {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('text')
  name: string;

  @Column('text')
  symbol: string;

  @Column('text')
  description: string;

  @Column('text', { nullable: true })
  imageUrl: string;

  @Column('text', { nullable: true })
  imageBase64: string;

  @Column('text', { nullable: true })
  twitter: string;

  @Column('text', { nullable: true })
  telegram: string;

  @Column('text', { nullable: true })
  website: string;

  @Column('text')
  metadataUri: string;

  @Column('text', { nullable: true })
  mintAddress: string;

  @Column('text', { nullable: true })
  txSignature: string;

  @Column('float', { nullable: true })
  buyAmount: number; // SOL amount for initial buy

  @Column('text', { default: 'pending' })
  status: 'pending' | 'generating' | 'created' | 'buying' | 'deployed' | 'failed';

  @Column('text', { nullable: true })
  errorMessage: string;

  @Column('text', { nullable: true })
  creatorAddress: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
