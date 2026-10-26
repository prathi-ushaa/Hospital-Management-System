import java.util.*;
import org.cloudbus.cloudsim.*;
import org.cloudbus.cloudsim.core.CloudSim;
import org.cloudbus.cloudsim.provisioners.*;

/**
 * Morning OPD rush simulation for the hospital system (CloudSim 3.0.3).
 * 70% of requests are light (appointment booking, patient lookup) and
 * 30% are heavy (billing reports, record searches). All arrive together,
 * and we compare VM counts and cloudlet scheduling policies.
 */
public class HospitalSimulation {

    static final int LIGHT_MI = 1000;
    static final int HEAVY_MI = 6000;
    static final double VM_MIPS = 1000;
    static final double COST_PER_VM_SEC = 0.0001; // illustrative rate

    public static void main(String[] args) throws Exception {
        int[] userCounts = {200, 1000, 2000};
        int[] vmCounts = {2, 5, 10};
        String[] policies = {"TimeShared", "SpaceShared"};

        System.out.printf("%-8s %-5s %-12s %-14s %-12s %-10s%n",
                "Requests", "VMs", "Scheduler", "AvgResp(s)", "Makespan(s)", "Cost");
        for (int n : userCounts)
            for (int vms : vmCounts)
                for (String p : policies)
                    run(n, vms, p);
    }

    static void run(int requests, int vmCount, String policy) throws Exception {
        Log.disable();
        CloudSim.init(1, Calendar.getInstance(), false);

        Datacenter dc = createDatacenter("HospitalDC");
        DatacenterBroker broker = new DatacenterBroker("Broker");
        int brokerId = broker.getId();

        List<Vm> vms = new ArrayList<>();
        for (int i = 0; i < vmCount; i++) {
            CloudletScheduler cs = policy.equals("TimeShared")
                    ? new CloudletSchedulerTimeShared() : new CloudletSchedulerSpaceShared();
            vms.add(new Vm(i, brokerId, VM_MIPS, 1, 1024, 1000, 10000, "Xen", cs));
        }

        Random rnd = new Random(42); // fixed seed so every run uses the same workload
        UtilizationModel full = new UtilizationModelFull();
        List<Cloudlet> cloudlets = new ArrayList<>();
        for (int i = 0; i < requests; i++) {
            int length = rnd.nextDouble() < 0.7 ? LIGHT_MI : HEAVY_MI;
            Cloudlet c = new Cloudlet(i, length, 1, 300, 300, full, full, full);
            c.setUserId(brokerId);
            cloudlets.add(c);
        }

        broker.submitVmList(vms);
        broker.submitCloudletList(cloudlets);
        CloudSim.startSimulation();
        List<Cloudlet> done = broker.getCloudletReceivedList();
        CloudSim.stopSimulation();

        double sum = 0, max = 0;
        int ok = 0;
        for (Cloudlet c : done) {
            if (c.getStatus() == Cloudlet.SUCCESS) {
                sum += c.getFinishTime();
                max = Math.max(max, c.getFinishTime());
                ok++;
            }
        }
        System.out.printf("%-8d %-5d %-12s %-14.2f %-12.2f %-10.4f%n",
                requests, vmCount, policy, ok == 0 ? 0 : sum / ok, max, vmCount * max * COST_PER_VM_SEC);
    }

    static Datacenter createDatacenter(String name) throws Exception {
        List<Host> hosts = new ArrayList<>();
        for (int h = 0; h < 4; h++) {
            List<Pe> pes = new ArrayList<>();
            for (int p = 0; p < 8; p++) pes.add(new Pe(p, new PeProvisionerSimple(2000)));
            hosts.add(new Host(h, new RamProvisionerSimple(32768), new BwProvisionerSimple(100000),
                    1000000, pes, new VmSchedulerTimeShared(pes)));
        }
        DatacenterCharacteristics ch = new DatacenterCharacteristics(
                "x86", "Linux", "Xen", hosts, 5.5, 3.0, 0.05, 0.001, 0.0);
        return new Datacenter(name, ch, new VmAllocationPolicySimple(hosts),
                new LinkedList<Storage>(), 0);
    }
}
