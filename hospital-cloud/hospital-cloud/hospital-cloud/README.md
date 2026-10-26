# Cloud-Based Hospital Management System

React + Node/Express + MongoDB, containerised with Docker, tested in a VirtualBox VM,
deployed on AWS EC2, with a CloudSim peak-load simulation.

> Use only made-up patient data. Real patient records need legal compliance (e.g. HIPAA / India's DPDP Act),
> which a college project does not provide.

```
hospital-cloud/
├── docker-compose.yml
├── backend/      Express API (JWT auth, patients, appointments, billing, stats)
├── frontend/     React (Vite) UI served by Nginx
└── cloudsim/     HospitalSimulation.java
```

## Roles
| Role | Can do |
|---|---|
| Admin / Receptionist | Register patients, book appointments, create and settle bills, see the dashboard |
| Doctor | See only their own appointments, mark them complete or cancelled, add visit notes |

## 1. Run locally with Docker
```bash
docker compose up --build
```
Open http://localhost. Create a **doctor**, a **receptionist** account, then:
register a patient -> book an appointment with the doctor -> create a bill -> mark it paid.
Log in as the doctor to see only their own appointments.

Handy: `docker compose logs -f backend`, `docker compose down`, `docker compose down -v` (wipes DB).

## 2. Run inside Oracle VirtualBox (private cloud)
1. Create an Ubuntu Server 22.04 VM (2 CPU, 4 GB RAM, 20 GB disk).
2. Network: NAT with port forwarding Host 8080 -> Guest 80 (and Host 2222 -> Guest 22 for SSH).
3. Inside the VM:
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker $USER && newgrp docker
cd hospital-cloud && docker compose up -d --build
```
4. Open http://localhost:8080 on your host. Screenshot the VM, `docker ps` and the app.

## 3. Deploy on AWS (Console)
1. **EC2** -> Launch instance: Ubuntu 22.04, t2.micro/t3.micro (free tier), create a key pair.
2. **Security Group** inbound: SSH (22) from *My IP*, HTTP (80) from anywhere.
3. SSH in, install Docker as above, copy the project, run `docker compose up -d --build`.
4. Open `http://<EC2-public-IP>`.
5. Extras for the report:
   - **S3**: store exported bills/reports (IAM role on the EC2 instance).
   - **CloudWatch**: CPU graph and an alarm at 70%.
   - **ALB + Auto Scaling Group** (optional): health check path `/api/health`.
   - Stop or terminate the instance when done to avoid charges.

## 4. CloudSim peak-load simulation
1. Download CloudSim 3.0.3 and note the path of `cloudsim-3.0.3.jar`.
2. From the `cloudsim/` folder:
```bash
javac -cp cloudsim-3.0.3.jar HospitalSimulation.java
java  -cp .:cloudsim-3.0.3.jar HospitalSimulation      # Windows: use ; instead of :
```
It simulates a morning OPD rush (70% light, 30% heavy requests) for 200/1000/2000 requests on
2/5/10 VMs, time-shared vs space-shared, and prints average response time, makespan and cost.
Chart it in Excel and use it to justify your EC2 size / Auto Scaling settings.

## Production notes (mention in viva)
- Open registration is demo-only; restrict staff account creation to admins.
- Set a strong `JWT_SECRET` (copy `.env.example` to `.env`).
- Add HTTPS (ALB + ACM), encrypt data at rest, keep audit logs, use managed MongoDB.
