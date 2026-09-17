#!/bin/zsh

docker compose up -d --build

sleep 5

cd backend

./mvnw spring-boot:run
