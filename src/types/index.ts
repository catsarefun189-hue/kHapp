// src/types/index.ts

export interface User {
    id: string;
    username: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
}

export interface GroupChat {
    id: string;
    name: string;
    users: User[];
    createdAt: Date;
    updatedAt: Date;
}

export interface Admin {
    id: string;
    username: string;
    permissions: string[];
    createdAt: Date;
    updatedAt: Date;
}

export interface QRCode {
    id: string;
    data: string;
    createdAt: Date;
    updatedAt: Date;
}