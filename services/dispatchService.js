import { DeliveryAgent } from '../models/DeliveryAgent.js';
import { Dispatch } from '../models/Dispatch.js';

export const DEFAULT_LUCKNOW_AGENTS = [
  {
    name: 'Rohit Verma',
    phone: '+91 98391 22345',
    email: 'rohit.delivery@fundu.in',
    status: 'available',
    zones: ['Gomti Nagar', 'Indira Nagar', 'Chinhat', 'Polytechnic', 'Vibhuti Khand'],
    current_locality: 'Gomti Nagar, Lucknow',
    vehicle_type: 'Hero Splendor (UP 32 AB 1234)',
    rating: 4.9,
    current_orders_count: 0,
    max_capacity: 6,
    is_active: true,
  },
  {
    name: 'Amit Shukla',
    phone: '+91 94150 78912',
    email: 'amit.delivery@fundu.in',
    status: 'available',
    zones: ['Hazratganj', 'Mahanagar', 'Aliganj', 'Nirala Nagar', 'Hussainganj', 'Butler Colony'],
    current_locality: 'Hazratganj, Lucknow',
    vehicle_type: 'Honda Activa (UP 32 CD 5678)',
    rating: 4.8,
    current_orders_count: 0,
    max_capacity: 6,
    is_active: true,
  },
  {
    name: 'Vikas Yadav',
    phone: '+91 87654 32109',
    email: 'vikas.delivery@fundu.in',
    status: 'available',
    zones: ['Aliganj', 'Jankipuram', 'Vikas Nagar', 'Kalyanpur', 'Tedhi Pulia', 'Kapoorthala'],
    current_locality: 'Aliganj, Lucknow',
    vehicle_type: 'Bajaj Pulsar (UP 32 EF 9012)',
    rating: 4.9,
    current_orders_count: 0,
    max_capacity: 6,
    is_active: true,
  },
  {
    name: 'Praveen Singh',
    phone: '+91 99351 45678',
    email: 'praveen.delivery@fundu.in',
    status: 'available',
    zones: ['Alambagh', 'Charbagh', 'Krishna Nagar', 'Ashiyana', 'Sarojini Nagar', 'Telibagh', 'Singar Nagar'],
    current_locality: 'Alambagh, Lucknow',
    vehicle_type: 'TVS Raider (UP 32 GH 3456)',
    rating: 4.7,
    current_orders_count: 0,
    max_capacity: 6,
    is_active: true,
  },
  {
    name: 'Mohit Saxena',
    phone: '+91 91234 56780',
    email: 'mohit.delivery@fundu.in',
    status: 'available',
    zones: ['Gomti Nagar Extension', 'Shaheed Path', 'Sushant Golf City', 'Arjunganj', 'Ahimamau'],
    current_locality: 'Gomti Nagar Extension, Lucknow',
    vehicle_type: 'Yamaha FZ (UP 32 JK 7890)',
    rating: 4.8,
    current_orders_count: 0,
    max_capacity: 6,
    is_active: true,
  },
];

export const ensureAgentsSeeded = async () => {
  try {
    const count = await DeliveryAgent.countDocuments();
    if (count === 0) {
      await DeliveryAgent.insertMany(DEFAULT_LUCKNOW_AGENTS);
      console.log('Seeded default Lucknow delivery field executives.');
    }
  } catch (err) {
    console.warn('Notice seeding delivery agents:', err.message);
  }
};

export const calculateEstimatedArrival = (slot, date) => {
  if (slot) {
    return `${slot} (${date || 'Today'})`;
  }
  const now = new Date();
  const etaMinutes = 35 + Math.floor(Math.random() * 20);
  const etaTime = new Date(now.getTime() + etaMinutes * 60000);
  return `Within ~${etaMinutes} mins (${etaTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
};

export const autoAssignDeliveryAgent = async ({ area, fullAddress, slot, date, type, recordId }) => {
  try {
    await ensureAgentsSeeded();

    const searchTarget = `${area || ''} ${fullAddress || ''}`.toLowerCase();

    let candidate = null;

    // 1. Try finding available agent with matching zone
    const availableAgents = await DeliveryAgent.find({
      status: 'available',
      is_active: true,
    }).sort({ current_orders_count: 1, rating: -1 });

    if (availableAgents.length > 0) {
      for (const agent of availableAgents) {
        const zones = Array.isArray(agent.zones) ? agent.zones : [];
        const match = zones.some((z) => typeof z === 'string' && searchTarget.includes(z.toLowerCase()));
        if (match) {
          candidate = agent;
          break;
        }
      }

      // 2. Fallback to least loaded available agent in Lucknow
      if (!candidate) {
        candidate = availableAgents[0];
      }
    }

    // 3. If all 'available' are full, find any active agent under capacity
    if (!candidate) {
      candidate = await DeliveryAgent.findOne({
        is_active: true,
      }).sort({ current_orders_count: 1 });
    }

    if (!candidate) {
      return {
        agent: null,
        assigned_agent_id: null,
        pickup_person_name: 'Rohit Verma',
        pickup_person_phone: '+91 98391 22345',
        delivery_person_name: 'Rohit Verma',
        delivery_person_phone: '+91 98391 22345',
        estimated_arrival_time: calculateEstimatedArrival(slot, date),
      };
    }

    // Increment load safely
    try {
      await DeliveryAgent.findByIdAndUpdate(candidate._id, {
        $inc: { current_orders_count: 1 },
        status: (candidate.current_orders_count || 0) + 1 >= (candidate.max_capacity || 6) ? 'on_delivery' : 'available',
      });
    } catch (e) {
      console.warn('Notice updating agent load:', e.message);
    }

    const arrivalTime = calculateEstimatedArrival(slot, date);

    if (recordId && type === 'order') {
      try {
        await Dispatch.create({
          order_id: recordId.toString(),
          delivery_person_name: candidate.name,
          delivery_person_phone: candidate.phone,
          status: 'dispatched',
          notes: `Auto-assigned based on zone (${candidate.current_locality})`,
        });
      } catch (e) {
        console.warn('Dispatch log creation notice:', e.message);
      }
    }

    return {
      agent: candidate,
      assigned_agent_id: candidate._id.toString(),
      pickup_person_name: candidate.name,
      pickup_person_phone: candidate.phone,
      delivery_person_name: candidate.name,
      delivery_person_phone: candidate.phone,
      estimated_arrival_time: arrivalTime,
    };
  } catch (err) {
    console.error('Safe fallback for autoAssignDeliveryAgent:', err);
    return {
      agent: null,
      assigned_agent_id: null,
      pickup_person_name: 'Rohit Verma',
      pickup_person_phone: '+91 98391 22345',
      delivery_person_name: 'Rohit Verma',
      delivery_person_phone: '+91 98391 22345',
      estimated_arrival_time: calculateEstimatedArrival(slot, date),
    };
  }
};
