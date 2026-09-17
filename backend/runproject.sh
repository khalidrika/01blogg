#!/bin/zsh

docker compose up -d --build

sleep 5

./mvnw spring-boot:run
